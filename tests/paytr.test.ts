import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { completeCheckout, createBookingHold, rejectBooking, startCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { handlePaytrNotification, paytrBasket, paytrNotificationHash } from "@/server/payments/paytr";
import { at, createFixture, LESSON_DAY, NOW } from "./helpers";

const MERCHANT_ID = "123456";
const KEY = "paytr-test-key";
const SALT = "paytr-test-salt";
const hmac = (data: string) => createHmac("sha256", KEY).update(data).digest("base64");

type Call = { url: string; body: URLSearchParams };
let calls: Call[] = [];
let statusQueryResponse: Record<string, unknown> = { status: "error", err_msg: "merchant_oid ile basarili odeme bulunamadi" };

beforeAll(() => {
  Object.assign(process.env, {
    PAYMENT_PROVIDER: "paytr",
    PAYTR_MERCHANT_ID: MERCHANT_ID,
    PAYTR_MERCHANT_KEY: KEY,
    PAYTR_MERCHANT_SALT: SALT,
    PAYTR_TEST_MODE: "1",
  });
  vi.stubGlobal("fetch", async (url: string, init: { body: URLSearchParams }) => {
    calls.push({ url, body: new URLSearchParams(init.body) });
    const json = url.endsWith("/api/get-token")
      ? { status: "success", token: "iframe-token-abc" }
      : url.endsWith("/iade")
        ? { status: "success", is_test: 1, merchant_oid: init.body.get("merchant_oid"), return_amount: init.body.get("return_amount") }
        : statusQueryResponse;
    return new Response(JSON.stringify(json));
  });
});

beforeEach(() => {
  calls = [];
  statusQueryResponse = { status: "error", err_msg: "merchant_oid ile basarili odeme bulunamadi" };
});

afterAll(async () => {
  vi.unstubAllGlobals();
  process.env.PAYMENT_PROVIDER = "mock";
  await db.$disconnect();
});

async function holdAndCheckout(hhmm: string) {
  const fixture = await createFixture();
  const student = await fixture.createStudent();
  const booking = await createBookingHold(
    { studentId: student.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, hhmm), durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" },
    NOW,
  );
  const redirectUrl = await startCheckout(booking.id, student.id, "85.105.1.2", NOW);
  const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
  return { fixture, student, booking, payment, redirectUrl };
}

function notification(merchantOid: string, status: "success" | "failed", totalAmount: string, extra: { failedReasonMessage?: string; hash?: string } = {}) {
  return {
    merchantOid,
    status,
    totalAmount,
    paymentAmount: totalAmount,
    hash: extra.hash ?? hmac(merchantOid + SALT + status + totalAmount),
    failedReasonMessage: extra.failedReasonMessage,
  };
}

describe("PayTR", () => {
  it("ödeme anahtarı isteği dokümandaki sırayla imzalanır", async () => {
    const { payment, redirectUrl, student } = await holdAndCheckout("10:00");
    expect(redirectUrl).toBe(`/odeme/paytr/${payment.id}`);
    expect(payment.providerToken).toBe(payment.id);
    expect(payment.raw).toEqual({ paytrIframeToken: "iframe-token-abc" });

    const request = calls.find((c) => c.url === "https://www.paytr.com/odeme/api/get-token")!;
    const f = (name: string) => request.body.get(name) ?? "";
    expect(f("merchant_oid")).toBe(payment.id);
    expect(f("payment_amount")).toBe("100000"); // 1.000 TL → kuruş
    expect(f("currency")).toBe("TL");
    expect(f("email")).toBe(student.email);
    expect(f("user_ip")).toBe("85.105.1.2");
    expect(f("merchant_ok_url")).toMatch(/\/api\/odeme\/paytr\/donus\?b=/);
    const expected = hmac(
      f("merchant_id") + f("user_ip") + f("merchant_oid") + f("email") + f("payment_amount") + f("user_basket") + f("no_installment") + f("max_installment") + f("currency") + f("test_mode") + SALT,
    );
    expect(f("paytr_token")).toBe(expected);

    const basket = JSON.parse(Buffer.from(f("user_basket"), "base64").toString("utf8"));
    expect(basket).toEqual([[expect.stringContaining("Matematik"), "1000.00", 1]]);
  });

  it("sepetteki Türkçe karakterler PHP json_encode gibi kaçışlanır", () => {
    const raw = Buffer.from(paytrBasket("Öğretmen dersi", 12345), "base64").toString("utf8");
    expect(raw).toBe('[["\\u00d6\\u011fretmen dersi","123.45",1]]');
    expect(JSON.parse(raw)).toEqual([["Öğretmen dersi", "123.45", 1]]);
  });

  it("bildirim gelmeden dönüş: beklemede kalır; imzalı bildirimle randevu onaya düşer, iade PayTR'ye gider", async () => {
    const { booking, payment, fixture } = await holdAndCheckout("12:00");

    // Bildirim henüz gelmedi ve PayTR'de başarılı ödeme yok: hiçbir şey değişmez
    expect((await completeCheckout(payment.providerToken!)).outcome).toBe("pending");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("INITIATED");

    // Sahte imza reddedilir
    const forged = notification(payment.id, "success", "100000", { hash: "sahte" });
    expect(await handlePaytrNotification(forged, completeCheckout)).toBe("bad-hash");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_PAYMENT");

    // Gerçek bildirim
    expect(paytrNotificationHash(payment.id, "success", "100000")).toBe(notification(payment.id, "success", "100000").hash);
    expect(await handlePaytrNotification(notification(payment.id, "success", "100000"), completeCheckout)).toBe("ok");
    const paid = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.status).toBe("SUCCEEDED");
    expect(paid.providerPaymentId).toBe(payment.id);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_APPROVAL");

    // Aynı bildirim tekrar gelirse yalnızca ilki işlenir
    const events = await db.bookingEvent.count({ where: { bookingId: booking.id } });
    expect(await handlePaytrNotification(notification(payment.id, "success", "100000"), completeCheckout)).toBe("ok");
    expect(await db.bookingEvent.count({ where: { bookingId: booking.id } })).toBe(events);

    // Öğretmen reddederse tam iade PayTR iade servisine imzalı gider
    await rejectBooking(booking.id, fixture.teacher.id, "O saatte başka dersim var");
    const refundCall = calls.find((c) => c.url === "https://www.paytr.com/odeme/iade")!;
    expect(refundCall.body.get("merchant_oid")).toBe(payment.id);
    expect(refundCall.body.get("return_amount")).toBe("1000.00");
    expect(refundCall.body.get("paytr_token")).toBe(hmac(MERCHANT_ID + payment.id + "1000.00" + SALT));
    const refunded = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { refunds: true } });
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refunds.map((r) => r.status)).toEqual(["SUCCEEDED"]);
  });

  it("başarısız bildirim ödemeyi düşürür; sonradan gelen başarılı bildirim randevuyu kurtarır", async () => {
    const { booking, payment } = await holdAndCheckout("14:00");
    expect(await handlePaytrNotification(notification(payment.id, "failed", "100000", { failedReasonMessage: "Yetersiz bakiye" }), completeCheckout)).toBe("ok");
    const failed = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBe("Yetersiz bakiye");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_PAYMENT");

    expect(await handlePaytrNotification(notification(payment.id, "success", "100000"), completeCheckout)).toBe("ok");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_APPROVAL");
  });

  it("bildirim ulaşmazsa dönüşte durum sorgusuyla ödeme onaylanır", async () => {
    const { booking, payment } = await holdAndCheckout("16:00");
    statusQueryResponse = { status: "success", payment_amount: "1000", payment_total: "1000", currency: "TL" };
    expect((await completeCheckout(payment.providerToken!)).outcome).toBe("paid");
    const query = calls.find((c) => c.url === "https://www.paytr.com/odeme/durum-sorgu")!;
    expect(query.body.get("paytr_token")).toBe(hmac(MERCHANT_ID + payment.id + SALT));
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_APPROVAL");
  });

  it("aynı randevu için ikinci ödeme gelirse yalnızca o ödeme iade edilir", async () => {
    const { booking, payment } = await holdAndCheckout("18:00");
    await handlePaytrNotification(notification(payment.id, "success", "100000"), completeCheckout);
    const second = await db.payment.create({ data: { bookingId: booking.id, provider: "paytr", amount: payment.amount } });
    await db.payment.update({ where: { id: second.id }, data: { providerToken: second.id } });

    expect(await handlePaytrNotification(notification(second.id, "success", "100000"), completeCheckout)).toBe("ok");
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("PENDING_APPROVAL");
    expect(fresh.refundedAmount).toBe(0);
    const refundCall = calls.find((c) => c.url === "https://www.paytr.com/odeme/iade")!;
    expect(refundCall.body.get("merchant_oid")).toBe(second.id);
    expect((await db.payment.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("REFUNDED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
  });

  it("başka sağlayıcıyla alınmış ödemeye PayTR bildirimi işlenmez", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const booking = await createBookingHold(
      { studentId: student.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, "20:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" },
      NOW,
    );
    const mockPayment = await db.payment.create({ data: { bookingId: booking.id, provider: "mock", amount: booking.price, providerToken: `mock-${booking.id}` } });
    expect(await handlePaytrNotification(notification(mockPayment.providerToken!, "success", "100000"), completeCheckout)).toBe("unknown-order");
    expect((await db.payment.findUniqueOrThrow({ where: { id: mockPayment.id } })).status).toBe("INITIATED");
  });
});

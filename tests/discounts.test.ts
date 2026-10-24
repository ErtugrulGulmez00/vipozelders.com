import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { completeCheckout, createBookingHold, startCheckout } from "@/server/bookings";
import { creditBalance, createCreditPurchase, startCreditCheckout } from "@/server/credits";
import { db } from "@/server/db";
import { DiscountError, ensureReferralCode, referrerForCode, resolveDiscount } from "@/server/discounts";
import { at, createFixture, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

const code = (prefix: string) => `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;

async function payBooking(studentId: string, offeringId: string, startAt: Date, couponCode?: string) {
  const booking = await createBookingHold({ studentId, offeringId, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali", couponCode }, NOW);
  await startCheckout(booking.id, studentId, "127.0.0.1", NOW);
  const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  await completeCheckout(payment.providerToken!, NOW);
  return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

describe("indirim kodu", () => {
  it("yüzdelik kod dersten düşer; öğretmen payı değişmez, indirim en fazla hizmet bedeli kadar olur", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    const student = await f.createStudent();
    const small = await db.coupon.create({ data: { code: code("YUZDE"), kind: "PERCENT", value: 10, targets: [] } });
    const booking = await payBooking(student.id, f.offering.id, at(LESSON_DAY, "10:00"), small.code.toLowerCase());
    expect(booking).toMatchObject({ price: 90000, discountAmount: 10000, commissionAmount: 5000, teacherAmount: 85000, couponCode: small.code });
    expect(await db.couponRedemption.count({ where: { couponId: small.id } })).toBe(1);

    const big = await db.coupon.create({ data: { code: code("BUYUK"), kind: "AMOUNT", value: 50000, targets: ["booking"] } });
    const other = await f.createStudent();
    const capped = await payBooking(other.id, f.offering.id, at(LESSON_DAY, "12:00"), big.code);
    // Hizmet bedeli %15 = 150 ₺; 500 ₺'lik kod en fazla 150 ₺ düşer
    expect(capped).toMatchObject({ price: 85000, discountAmount: 15000, commissionAmount: 0, teacherAmount: 85000 });
  });

  it("geçersiz, süresi dolmuş, başka satış türüne ait ya da kullanılmış kod reddedilir", async () => {
    const f = await createFixture();
    const student = await f.createStudent();
    await expect(resolveDiscount(student.id, "YOKBOYLE", "booking", 100000, 15000)).rejects.toThrow(DiscountError);
    const expired = await db.coupon.create({ data: { code: code("ESKI"), kind: "PERCENT", value: 10, targets: [], endsAt: new Date(Date.now() - 1000) } });
    await expect(resolveDiscount(student.id, expired.code, "booking", 100000, 15000)).rejects.toThrow(/süresi/);
    const groupOnly = await db.coupon.create({ data: { code: code("GRUP"), kind: "PERCENT", value: 10, targets: ["group"] } });
    await expect(resolveDiscount(student.id, groupOnly.code, "booking", 100000, 15000)).rejects.toThrow(/Grup dersi/);
    const once = await db.coupon.create({ data: { code: code("TEK"), kind: "PERCENT", value: 10, targets: [] } });
    await payBooking(student.id, f.offering.id, at(LESSON_DAY, "14:00"), once.code);
    await expect(resolveDiscount(student.id, once.code, "booking", 100000, 15000)).rejects.toThrow(/daha önce/);
  });

  it("soru kredisinde indirim tutarın tamamından düşebilir (en az 1 ₺ ödenir)", async () => {
    const f = await createFixture();
    const student = await f.createStudent();
    const coupon = await db.coupon.create({ data: { code: code("KREDI"), kind: "PERCENT", value: 50, targets: ["credits"] } });
    const purchase = await createCreditPurchase(student.id, 10, coupon.code);
    expect(purchase).toMatchObject({ price: 10000, discountAmount: 10000 });
  });
});

describe("arkadaşını getir", () => {
  it("davetle gelen üyeye ilk siparişte indirim, ilk ödemede davet edene soru kredisi", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    const referrer = await f.createStudent();
    const inviteCode = await ensureReferralCode(referrer.id);
    expect(await ensureReferralCode(referrer.id)).toBe(inviteCode);
    expect(await referrerForCode(inviteCode.toLowerCase())).toBe(referrer.id);

    const friend = await f.createStudent();
    await db.user.update({ where: { id: friend.id }, data: { referredById: referrer.id } });
    const booking = await payBooking(friend.id, f.offering.id, at(LESSON_DAY, "16:00"));
    // Varsayılan %10, hizmet bedelinden
    expect(booking).toMatchObject({ price: 90000, discountAmount: 10000, couponCode: null });
    expect(await creditBalance(referrer.id, db)).toBe(3);
    expect((await db.user.findUniqueOrThrow({ where: { id: friend.id } })).referralRewardedAt).not.toBeNull();

    // İkinci siparişte ne indirim ne ikinci ödül
    const second = await createCreditPurchase(friend.id, 10);
    expect(second.discountAmount).toBe(0);
    await startCreditCheckout(second.id, friend.id, "127.0.0.1");
    const payment = await db.payment.findFirstOrThrow({ where: { creditPurchaseId: second.id } });
    await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
    await completeCheckout(payment.providerToken!, NOW);
    expect(await creditBalance(referrer.id, db)).toBe(3);
  });
});

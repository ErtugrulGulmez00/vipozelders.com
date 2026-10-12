import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { appUrl } from "../email";
import { toProviderAmount, type CheckoutResult, type PaymentProvider } from "./types";

/**
 * PayTR iFrame API (https://dev.paytr.com). Akış:
 *  1. get-token ile ödeme anahtarı alınır; ödeme formu sitede iframe içinde açılır (/odeme/paytr/[paymentId]).
 *  2. PayTR sonucu sunucudan sunucuya "Bildirim URL"sine POST eder (/api/odeme/paytr/bildirim).
 *     İmza doğrulanınca sonuç kaydedilir ve randevu sonuçlandırılır. Yanıt düz metin "OK" olmalıdır.
 *  3. Müşteri dönüş sayfasına geldiğinde bildirim henüz ulaşmadıysa durum sorgu servisiyle kontrol edilir.
 *  4. İadeler /odeme/iade servisiyle yapılır.
 * Bildirim URL'si PayTR mağaza panelinden (Destek & Kurulum → Ayarlar) girilir.
 */

const API = "https://www.paytr.com/odeme";

export type PaytrConfig = { merchantId: string; key: string; salt: string; testMode: "0" | "1" };

export function paytrConfig(): PaytrConfig {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const key = process.env.PAYTR_MERCHANT_KEY;
  const salt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !key || !salt) throw new Error("PAYTR_MERCHANT_ID / PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT tanımlı değil.");
  return { merchantId, key, salt, testMode: process.env.PAYTR_TEST_MODE === "0" ? "0" : "1" };
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function post(path: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { status: "failed", reason: text.slice(0, 300) };
  }
}

/** Sepet: base64(JSON [[ad, birim fiyat "TL.kk", adet]]). Türkçe karakterler PHP json_encode gibi \uXXXX yazılır. */
export function paytrBasket(name: string, amountKurus: number): string {
  const json = JSON.stringify([[name.slice(0, 100), toProviderAmount(amountKurus), 1]]).replace(
    /[\u007f-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return Buffer.from(json).toString("base64");
}

/** get-token imzası: base64(HMAC-SHA256(merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode + salt, key)) */
export function paytrTokenHash(
  fields: { userIp: string; merchantOid: string; email: string; paymentAmount: string; basket: string; noInstallment: string; maxInstallment: string; currency: string },
  config: PaytrConfig,
): string {
  const hashString = config.merchantId + fields.userIp + fields.merchantOid + fields.email + fields.paymentAmount + fields.basket + fields.noInstallment + fields.maxInstallment + fields.currency + config.testMode;
  return sign(hashString + config.salt, config.key);
}

/** Bildirim imzası: base64(HMAC-SHA256(merchant_oid + salt + status + total_amount, key)) */
export function paytrNotificationHash(merchantOid: string, status: string, totalAmount: string, config = paytrConfig()): string {
  return sign(merchantOid + config.salt + status + totalAmount, config.key);
}

/** PayTR durum sorgusundaki tutar: "1250,5" / "1250.50" (TL) → kuruş */
function parsePaytrMoney(value: unknown): number {
  const text = String(value ?? "").trim();
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return Math.round(Number(normalized) * 100);
}

type PaytrCallback = { status: string; payment_amount: string; total_amount: string; failed_reason_msg?: string; payment_type?: string; test_mode?: string; source?: "notification" | "status-query" };

/** Bildirim gelmediyse PayTR'ye sorar. Yalnızca başarılı ödeme bulunursa sonuç döner; aksi hâlde beklemeye devam edilir. */
async function queryStatus(merchantOid: string): Promise<PaytrCallback | null> {
  const config = paytrConfig();
  const result = await post("/durum-sorgu", {
    merchant_id: config.merchantId,
    merchant_oid: merchantOid,
    paytr_token: sign(config.merchantId + merchantOid + config.salt, config.key),
  });
  if (result.status !== "success") return null;
  return {
    status: "success",
    payment_amount: String(parsePaytrMoney(result.payment_amount)),
    total_amount: String(parsePaytrMoney(result.payment_total ?? result.payment_amount)),
    source: "status-query",
  };
}

export const paytrProvider: PaymentProvider = {
  id: "paytr",
  automaticPayouts: false,
  requiresSubMerchant: false,

  async createCheckout(request) {
    const config = paytrConfig();
    const fields = {
      userIp: request.buyer.ipAddress,
      merchantOid: request.paymentId, // cuid: yalnızca harf ve rakam
      email: request.buyer.email,
      paymentAmount: String(request.amount), // kuruş (TL × 100)
      basket: paytrBasket(request.description, request.amount),
      noInstallment: "1", // taksit yok: tahsil edilen tutar = ders ücreti
      maxInstallment: "0",
      currency: "TL",
    };
    const returnUrl = appUrl(`/api/odeme/paytr/donus?b=${request.bookingId}`);

    const result = await post("/api/get-token", {
      merchant_id: config.merchantId,
      user_ip: fields.userIp,
      merchant_oid: fields.merchantOid,
      email: fields.email,
      payment_amount: fields.paymentAmount,
      paytr_token: paytrTokenHash(fields, config),
      user_basket: fields.basket,
      debug_on: config.testMode,
      no_installment: fields.noInstallment,
      max_installment: fields.maxInstallment,
      user_name: `${request.buyer.firstName} ${request.buyer.lastName}`.slice(0, 60),
      user_address: (request.buyer.city ?? "Türkiye").slice(0, 400),
      user_phone: (request.buyer.phone ?? "05000000000").slice(0, 20),
      merchant_ok_url: returnUrl,
      merchant_fail_url: returnUrl,
      timeout_limit: "30",
      currency: fields.currency,
      test_mode: config.testMode,
      lang: "tr",
    });
    if (result.status !== "success" || typeof result.token !== "string") {
      throw new Error(`PayTR: ${String(result.reason ?? "ödeme anahtarı alınamadı")}`);
    }
    await db.payment.update({ where: { id: request.paymentId }, data: { raw: { paytrIframeToken: result.token } } });
    return { token: fields.merchantOid, redirectUrl: `/odeme/paytr/${request.paymentId}` };
  },

  async retrieveResult(token): Promise<CheckoutResult> {
    const payment = await db.payment.findUnique({ where: { providerToken: token } });
    if (!payment) return { status: "failure", reason: "Ödeme kaydı bulunamadı.", raw: null };
    const callback = (payment.raw as { paytrCallback?: PaytrCallback } | null)?.paytrCallback ?? (await queryStatus(token).catch(() => null));
    if (!callback) return { status: "pending" };
    if (callback.status !== "success") {
      return { status: "failure", reason: callback.failed_reason_msg || "Ödeme bankanız tarafından onaylanmadı.", raw: callback };
    }
    return { status: "success", paidAmount: Number(callback.payment_amount), providerPaymentId: token, providerItemId: null, raw: callback };
  },

  async refund(input) {
    const config = paytrConfig();
    const returnAmount = toProviderAmount(input.amount);
    const result = await post("/iade", {
      merchant_id: config.merchantId,
      merchant_oid: input.providerPaymentId,
      return_amount: returnAmount,
      paytr_token: sign(config.merchantId + input.providerPaymentId + returnAmount + config.salt, config.key),
      reference_no: input.reference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64),
    });
    return result.status === "success"
      ? { ok: true, reference: input.reference }
      : { ok: false, error: `PayTR iade: ${String(result.err_msg ?? result.reason ?? "başarısız")}` };
  },

  async releaseToTeacher() {
    // Hakedişler yönetim panelinden havale kaydıyla ödenir (PayTR Pazaryeri sonradan bağlanabilir).
    return { ok: true };
  },

  async registerSubMerchant() {
    return { ok: false, error: "PayTR ile öğretmen alt hesabı gerekmez; hakedişler havaleyle ödenir." };
  },
};

export type PaytrNotification = {
  merchantOid: string;
  status: string;
  totalAmount: string;
  paymentAmount: string;
  hash: string;
  failedReasonMessage?: string;
  paymentType?: string;
  testMode?: string;
};

/**
 * PayTR bildirimini işler: imzayı doğrular, sonucu ödemeye yazar ve randevuyu sonuçlandırır.
 * Aynı bildirim birden çok kez gelebilir; yalnızca ilki işlenir.
 */
export async function handlePaytrNotification(
  notification: PaytrNotification,
  complete: (token: string) => Promise<unknown>,
): Promise<"ok" | "bad-hash" | "unknown-order"> {
  const expected = paytrNotificationHash(notification.merchantOid, notification.status, notification.totalAmount);
  if (!safeEqual(expected, notification.hash)) return "bad-hash";

  const payment = await db.payment.findUnique({ where: { providerToken: notification.merchantOid } });
  if (!payment || payment.provider !== "paytr") return "unknown-order";

  // Başarısız sayılan bir ödeme için sonradan "başarılı" bildirimi gelirse para çekilmiştir: yeniden değerlendirilir
  // (saat hâlâ boşsa randevu ilerler, değilse ücret otomatik iade edilir).
  const reopen = payment.status === "FAILED" && notification.status === "success";
  if (payment.status !== "INITIATED" && !reopen) return "ok";

  const previous = (payment.raw as Record<string, unknown> | null) ?? {};
  const callback: PaytrCallback = {
    status: notification.status,
    payment_amount: notification.paymentAmount,
    total_amount: notification.totalAmount,
    failed_reason_msg: notification.failedReasonMessage,
    payment_type: notification.paymentType,
    test_mode: notification.testMode,
    source: "notification",
  };
  const updated = await db.payment.updateMany({
    where: { id: payment.id, status: payment.status },
    data: { status: "INITIATED", failureReason: null, raw: { ...previous, paytrCallback: callback } as Prisma.InputJsonValue },
  });
  if (updated.count === 1) await complete(notification.merchantOid);
  return "ok";
}

import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { appUrl } from "../email";
import type { CheckoutResult, PaymentProvider, ProviderCallResult } from "./types";

/**
 * Garanti BBVA Sanal POS, Ortak Ödeme Sayfası (3D_OOS_PAY). Akış:
 *  1. Sitedeki /odeme/garanti/[paymentId] sayfası imzalı formu bankanın gt3dengine adresine gönderir; kart bilgisi
 *     yalnızca bankanın sayfasında girilir, 3D Secure doğrulaması orada yapılır.
 *  2. Banka müşteriyi /api/odeme/garanti/donus adresine (POST) geri gönderir. Dönen alanlara güvenilmez:
 *     sonuç sunucudan bankaya sipariş sorgusuyla (orderinq) doğrulanır, tutar karşılaştırılır.
 *  3. İadeler XML ile (PROVRFN); aynı gün iade kabul edilmezse tam tutar için iptal (void) denenir.
 * Belge: https://dev.garantibbva.com.tr (Sanal POS → Ortak Ödeme Sayfası, Sorgulama, İade).
 */

export type GarantiMode = "TEST" | "PROD";

type GarantiConfig = {
  mode: GarantiMode;
  merchantId: string;
  terminalId: string;
  oosPassword: string;
  authPassword: string;
  refundPassword: string;
  storeKey: string;
  companyName: string;
  formUrl: string;
  apiUrl: string;
};

/** Bankanın herkese açık test terminali (dev.garantibbva.com.tr); gerçek para hareketi olmaz. */
const TEST_TERMINAL = { merchantId: "7000679", terminalId: "30691297", password: "123qweASD/", storeKey: "12345678" };

export function garantiConfigured(): boolean {
  const e = process.env;
  return Boolean(e.GARANTI_MERCHANT_ID && e.GARANTI_TERMINAL_ID && e.GARANTI_PROV_PASSWORD && e.GARANTI_REFUND_PASSWORD && e.GARANTI_STORE_KEY);
}

/** Varsayılan çalışma modu: .env'de GARANTI_MODE="PROD" yoksa test terminali kullanılır. */
export function defaultGarantiMode(): GarantiMode {
  return process.env.GARANTI_MODE === "PROD" ? "PROD" : "TEST";
}

export function garantiConfig(mode: GarantiMode = defaultGarantiMode()): GarantiConfig {
  const companyName = (process.env.GARANTI_COMPANY_NAME || "PI KAMPUS").slice(0, 60);
  if (mode === "TEST") {
    return {
      mode,
      merchantId: TEST_TERMINAL.merchantId,
      terminalId: TEST_TERMINAL.terminalId,
      oosPassword: TEST_TERMINAL.password,
      authPassword: TEST_TERMINAL.password,
      refundPassword: TEST_TERMINAL.password,
      storeKey: TEST_TERMINAL.storeKey,
      companyName,
      formUrl: "https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine",
      apiUrl: "https://sanalposprovtest.garantibbva.com.tr/VPServlet",
    };
  }
  if (!garantiConfigured()) throw new Error("GARANTI_MERCHANT_ID / GARANTI_TERMINAL_ID / GARANTI_PROV_PASSWORD / GARANTI_REFUND_PASSWORD / GARANTI_STORE_KEY tanımlı değil.");
  const e = process.env;
  return {
    mode,
    merchantId: e.GARANTI_MERCHANT_ID!,
    terminalId: e.GARANTI_TERMINAL_ID!,
    authPassword: e.GARANTI_PROV_PASSWORD!,
    oosPassword: e.GARANTI_OOS_PASSWORD || e.GARANTI_PROV_PASSWORD!,
    refundPassword: e.GARANTI_REFUND_PASSWORD!,
    storeKey: e.GARANTI_STORE_KEY!,
    companyName,
    formUrl: "https://sanalposprov.garanti.com.tr/servlet/gt3dengine",
    apiUrl: "https://sanalposprov.garanti.com.tr/VPServlet",
  };
}

// Banka metinleri ISO-8859-9 bekler; şifre ve alanlar ASCII olduğundan latin1 ile aynı baytlar üretilir.
const sha1 = (text: string) => createHash("sha1").update(Buffer.from(text, "latin1")).digest("hex").toUpperCase();
const sha512 = (text: string) => createHash("sha512").update(Buffer.from(text, "latin1")).digest("hex").toUpperCase();

/** Kullanıcı şifresinin özeti: SHA1(şifre + 9 haneye tamamlanmış terminal no). */
export function hashedPassword(password: string, terminalId: string): string {
  return sha1(password + terminalId.padStart(9, "0"));
}

/** Ortak ödeme sayfası formu imzası (secure3dhash). */
export function secure3dHash(input: { terminalId: string; orderId: string; amount: string; currency: string; successUrl: string; errorUrl: string; type: string; installment: string; storeKey: string; password: string }): string {
  const { terminalId, orderId, amount, currency, successUrl, errorUrl, type, installment, storeKey, password } = input;
  return sha512(terminalId + orderId + amount + currency + successUrl + errorUrl + type + installment + storeKey + hashedPassword(password, terminalId));
}

/** XML işlemleri imzası (HashData); sorgu, iade ve iptalde kart numarası boştur. */
export function xmlHash(input: { orderId: string; terminalId: string; cardNumber?: string; amount: string; currency: string; password: string }): string {
  return sha512(input.orderId + input.terminalId + (input.cardNumber ?? "") + input.amount + input.currency + hashedPassword(input.password, input.terminalId));
}

const CURRENCY = "949"; // TL

/** Bankaya gönderilecek ortak ödeme sayfası alanları. Tutar kuruş (LLLLLLKK): 100 = 1,00 TL. */
export function oosFormFields(config: GarantiConfig, input: { orderId: string; amount: number; email: string; ipAddress: string; returnUrl: string; now?: Date }): Record<string, string> {
  const amount = String(input.amount);
  return {
    mode: config.mode,
    apiversion: "512",
    secure3dsecuritylevel: "3D_OOS_PAY",
    terminalprovuserid: "PROVOOS",
    terminaluserid: "PIKAMPUS",
    terminalmerchantid: config.merchantId,
    terminalid: config.terminalId,
    orderid: input.orderId,
    successurl: input.returnUrl,
    errorurl: input.returnUrl,
    customeremailaddress: input.email,
    customeripaddress: input.ipAddress,
    companyname: config.companyName,
    lang: "tr",
    txntimestamp: (input.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
    refreshtime: "0",
    txnamount: amount,
    txntype: "sales",
    txncurrencycode: CURRENCY,
    txninstallmentcount: "",
    secure3dhash: secure3dHash({
      terminalId: config.terminalId,
      orderId: input.orderId,
      amount,
      currency: CURRENCY,
      successUrl: input.returnUrl,
      errorUrl: input.returnUrl,
      type: "sales",
      installment: "",
      storeKey: config.storeKey,
      password: config.oosPassword,
    }),
  };
}

const escapeXml = (text: string) => text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** Basit XML okuyucu: ilk <name>…</name> bloğunun içeriği (yanıt yapısı sabit, iç içe aynı ad yok). */
export function xmlBlock(xml: string, ...path: string[]): string {
  let current = xml;
  for (const name of path) {
    const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(current);
    if (!match) return "";
    current = match[1];
  }
  return current.trim();
}

type XmlResponse = { code: string; reasonCode: string; message: string; raw: string };

async function xmlCall(config: GarantiConfig, user: "PROVAUT" | "PROVRFN", input: { type: "orderinq" | "refund" | "void"; orderId: string; amount: number; originalRetrefNum?: string; ipAddress?: string }): Promise<XmlResponse> {
  const amount = String(input.amount);
  const password = user === "PROVRFN" ? config.refundPassword : config.authPassword;
  const hash = xmlHash({ orderId: input.orderId, terminalId: config.terminalId, amount, currency: CURRENCY, password });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GVPSRequest><Mode>${config.mode}</Mode><Version>512</Version>
<Terminal><ProvUserID>${user}</ProvUserID><HashData>${hash}</HashData><UserID>${user}</UserID><ID>${config.terminalId}</ID><MerchantID>${config.merchantId}</MerchantID></Terminal>
<Customer><IPAddress>${escapeXml(input.ipAddress ?? "127.0.0.1")}</IPAddress><EmailAddress>${escapeXml(process.env.GARANTI_NOTIFY_EMAIL || "odeme@pikampus.com")}</EmailAddress></Customer>
<Order><OrderID>${escapeXml(input.orderId)}</OrderID><GroupID></GroupID></Order>
<Transaction><Type>${input.type}</Type>${input.type === "orderinq" ? "<ListPageNum>0</ListPageNum>" : ""}<Amount>${amount}</Amount><CurrencyCode>${CURRENCY}</CurrencyCode><CardholderPresentCode>0</CardholderPresentCode><MotoInd>N</MotoInd>${input.originalRetrefNum ? `<OriginalRetrefNum>${escapeXml(input.originalRetrefNum)}</OriginalRetrefNum>` : ""}</Transaction>
</GVPSRequest>`;
  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: xml }),
    signal: AbortSignal.timeout(20_000),
  });
  const raw = await response.text();
  const res = xmlBlock(raw, "Transaction", "Response");
  return { code: xmlBlock(res, "Code"), reasonCode: xmlBlock(res, "ReasonCode"), message: xmlBlock(res, "ErrorMsg") || xmlBlock(res, "Message"), raw };
}

/** Bankadan dönen formun saklanan özeti (kart bilgisi yoktur). */
export type GarantiCallback = { mdstatus: string; procreturncode: string; response: string; errmsg: string; mderrormessage: string; receivedAt: string };
type GarantiRaw = { garantiMode?: GarantiMode; garantiForm?: Record<string, string>; garantiCallback?: GarantiCallback; diagnostic?: boolean };

export function garantiRaw(raw: unknown): GarantiRaw {
  return raw && typeof raw === "object" ? (raw as GarantiRaw) : {};
}

/** Sipariş sorgusu: ödemenin bankada gerçekten onaylanıp onaylanmadığını ve tutarını döndürür. */
export async function inquireOrder(orderId: string, amount: number, mode: GarantiMode) {
  const config = garantiConfig(mode);
  const res = await xmlCall(config, "PROVAUT", { type: "orderinq", orderId, amount });
  const result = xmlBlock(res.raw, "Order", "OrderInqResult");
  return {
    ...res,
    approved: res.code === "00" && Number(xmlBlock(result, "AuthAmount") || "0") > 0,
    authAmount: Number(xmlBlock(result, "AuthAmount") || "0"),
    status: xmlBlock(result, "Status"),
    retrefNum: xmlBlock(result, "RetrefNum"),
    authCode: xmlBlock(result, "AuthCode"),
    notFound: res.reasonCode === "0110",
  };
}

async function modeOfOrder(orderId: string): Promise<GarantiMode> {
  const payment = await db.payment.findUnique({ where: { providerToken: orderId }, select: { raw: true } });
  return garantiRaw(payment?.raw).garantiMode ?? defaultGarantiMode();
}

export const garantiProvider: PaymentProvider = {
  id: "garanti",
  automaticPayouts: false,
  requiresSubMerchant: false,

  async createCheckout(request) {
    const mode = defaultGarantiMode();
    const config = garantiConfig(mode);
    const fields = oosFormFields(config, {
      orderId: request.paymentId, // cuid: harf ve rakam
      amount: request.amount,
      email: request.buyer.email,
      ipAddress: request.buyer.ipAddress,
      returnUrl: appUrl("/api/odeme/garanti/donus"),
    });
    await db.payment.update({ where: { id: request.paymentId }, data: { raw: { garantiMode: mode, garantiForm: fields } satisfies Prisma.InputJsonValue } });
    return { token: request.paymentId, redirectUrl: `/odeme/garanti/${request.paymentId}` };
  },

  async retrieveResult(token): Promise<CheckoutResult> {
    const payment = await db.payment.findUnique({ where: { providerToken: token } });
    if (!payment) return { status: "failure", reason: "Ödeme kaydı bulunamadı.", raw: null };
    const raw = garantiRaw(payment.raw);
    const mode = raw.garantiMode ?? defaultGarantiMode();
    const inquiry = await inquireOrder(token, payment.amount, mode);
    const summary = { code: inquiry.code, reasonCode: inquiry.reasonCode, status: inquiry.status, authAmount: inquiry.authAmount, authCode: inquiry.authCode, retrefNum: inquiry.retrefNum, garantiMode: mode, callback: raw.garantiCallback ?? null };
    if (inquiry.approved) {
      return { status: "success", paidAmount: inquiry.authAmount, providerPaymentId: token, providerItemId: inquiry.retrefNum || null, raw: summary };
    }
    const callback = raw.garantiCallback;
    // Banka sayfasından dönüş olmadıysa müşteri hâlâ ödeme sayfasında olabilir.
    if (!callback) return { status: "pending" };
    const failedAtBank = callback.procreturncode && callback.procreturncode !== "00";
    if (failedAtBank || inquiry.notFound) {
      return { status: "failure", reason: callback.errmsg || callback.mderrormessage || inquiry.message || "Ödeme bankanız tarafından onaylanmadı.", raw: summary };
    }
    return { status: "pending" };
  },

  async refund(input): Promise<ProviderCallResult> {
    const config = garantiConfig(await modeOfOrder(input.providerPaymentId));
    const refund = await xmlCall(config, "PROVRFN", { type: "refund", orderId: input.providerPaymentId, amount: input.amount, ipAddress: input.ipAddress });
    if (refund.code === "00") return { ok: true, reference: input.reference };
    // Gün sonu kapanmadan iade kabul edilmeyebilir: tam tutar için aynı gün iptal (void) denenir.
    if (input.providerItemId) {
      const inquiry = await inquireOrder(input.providerPaymentId, input.amount, config.mode).catch(() => null);
      if (inquiry?.approved && inquiry.authAmount === input.amount) {
        const voided = await xmlCall(config, "PROVRFN", { type: "void", orderId: input.providerPaymentId, amount: input.amount, originalRetrefNum: input.providerItemId, ipAddress: input.ipAddress });
        if (voided.code === "00") return { ok: true, reference: input.reference };
        return { ok: false, error: `Garanti iade: ${refund.message || refund.reasonCode}; iptal: ${voided.message || voided.reasonCode}` };
      }
    }
    return { ok: false, error: `Garanti iade: ${refund.message || refund.reasonCode || "başarısız"}` };
  },

  async releaseToTeacher() {
    // Garanti sanal POS'ta para üye işyeri hesabına gelir; hakedişler yönetim panelinden havaleyle ödenir.
    return { ok: true };
  },

  async registerSubMerchant() {
    return { ok: false, error: "Garanti sanal POS ile öğretmen alt hesabı gerekmez; hakedişler havaleyle ödenir." };
  },
};

/** Bankadan dönüş formunu ödeme kaydına yazar (yalnızca durum alanları; kart bilgisi saklanmaz). */
export async function saveGarantiCallback(orderId: string, form: Record<string, string>) {
  const payment = await db.payment.findUnique({ where: { providerToken: orderId } });
  if (!payment || payment.provider !== "garanti") return null;
  const callback: GarantiCallback = {
    mdstatus: (form.mdstatus ?? "").slice(0, 10),
    procreturncode: (form.procreturncode ?? "").slice(0, 10),
    response: (form.response ?? "").slice(0, 40),
    errmsg: (form.errmsg ?? "").slice(0, 300),
    mderrormessage: (form.mderrormessage ?? "").slice(0, 300),
    receivedAt: new Date().toISOString(),
  };
  const raw = { ...garantiRaw(payment.raw), garantiCallback: callback };
  await db.payment.update({ where: { id: payment.id }, data: { raw: raw as Prisma.InputJsonValue } });
  return { ...payment, raw };
}

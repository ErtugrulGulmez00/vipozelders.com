import { randomInt } from "node:crypto";
import type { CreditPurchase, Prisma } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { db, type DbTransaction } from "./db";
import { appUrl } from "./email";
import { notify } from "./notifications";
import { getPaymentProvider, getProviderById, processRefund, salesOpen } from "./payments/service";
import { DiscountError, recordPaidOrder, resolveDiscount } from "./discounts";
import { loadSettings, type SiteSettings } from "./settings";

// Soru kredisi: 1 kredi = 1 soru. Krediler paket (satın alma) bazında tutulur; her paketin son kullanma tarihi vardır.
// Bakiye her zaman CreditLedger hareketlerinin toplamıdır. Harcama en eski (süresi dolmamış) paketten yapılır.

export class CreditError extends Error {}

type Tx = DbTransaction | typeof db;

export type QuestionPackage = { credits: number; price: number };

/** "1:25,10:200" → [{credits:1, price:2500}, …] (kuruş). Hatalı satırlar atlanır. */
export function parsePackages(text: string): QuestionPackage[] {
  const packages = text
    .split(/[,\n]+/)
    .map((part) => part.trim().split(/[:=]/).map((n) => Number(n.trim().replace(",", "."))))
    .filter(([credits, price]) => Number.isInteger(credits) && credits > 0 && credits <= 1000 && Number.isFinite(price) && price > 0)
    .map(([credits, price]) => ({ credits, price: Math.round(price * 100) }));
  const unique = new Map(packages.map((p) => [p.credits, p]));
  return [...unique.values()].sort((a, b) => a.credits - b.credits);
}

/** Tek soru fiyatı: 1 kredilik paket; yoksa en pahalı birim fiyat. */
export function singleQuestionPrice(packages: QuestionPackage[]): number {
  const single = packages.find((p) => p.credits === 1);
  if (single) return single.price;
  return Math.max(0, ...packages.map((p) => Math.ceil(p.price / p.credits)));
}

/**
 * Kısmi iade: ödenen tutardan kullanılan krediler tek soru fiyatıyla düşülür (büyük paket alıp iade ederek
 * ucuza soru çözdürme açığı kapanır).
 */
export function refundableAmount(purchase: Pick<CreditPurchase, "price" | "singlePrice" | "refundedAmount">, usedCredits: number): number {
  return Math.max(0, purchase.price - purchase.refundedAmount - usedCredits * purchase.singlePrice);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCode(prefix: string) {
  let code = `${prefix}-`;
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Aynı öğrencinin kredi işlemlerini sıraya sokar (iki soru aynı anda gönderilse bile bakiye eksiye düşmez). */
export async function lockStudentCredits(tx: DbTransaction, studentId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`credits:${studentId}`}))`;
}

/** Paketlerin kalan kredisi (yalnızca ödenmiş paketler). */
export async function creditLots(studentId: string, tx: Tx = db, now = new Date()) {
  const purchases = await tx.creditPurchase.findMany({
    where: { studentId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
    orderBy: { paidAt: "asc" },
  });
  if (!purchases.length) return [];
  const sums = await tx.creditLedger.groupBy({ by: ["purchaseId"], where: { purchaseId: { in: purchases.map((p) => p.id) } }, _sum: { amount: true } });
  const remaining = new Map(sums.map((s) => [s.purchaseId, s._sum.amount ?? 0]));
  return purchases.map((p) => ({ ...p, remaining: remaining.get(p.id) ?? 0, expired: Boolean(p.expiresAt && p.expiresAt <= now) }));
}

export async function creditBalance(studentId: string, tx: Tx = db, now = new Date()) {
  const lots = await creditLots(studentId, tx, now);
  return lots.filter((l) => !l.expired).reduce((t, l) => t + Math.max(0, l.remaining), 0);
}

/** Bir paketten kullanılan kredi (harcanan − geri dönen). */
export async function usedCredits(purchaseId: string, tx: Tx = db) {
  const rows = await tx.creditLedger.groupBy({ by: ["kind"], where: { purchaseId, kind: { in: ["SPEND", "RETURN"] } }, _sum: { amount: true } });
  const spend = rows.find((r) => r.kind === "SPEND")?._sum.amount ?? 0;
  const back = rows.find((r) => r.kind === "RETURN")?._sum.amount ?? 0;
  return Math.max(0, -(spend + back));
}

/** Soru için 1 kredi harcar (en eski geçerli paketten). Transaction içinde, öğrenci kilidiyle çağrılmalı. */
export async function spendCredit(tx: DbTransaction, studentId: string, now = new Date()): Promise<string> {
  const lots = await creditLots(studentId, tx, now);
  const lot = lots.find((l) => !l.expired && l.remaining > 0);
  if (!lot) throw new CreditError("Soru krediniz yok. Önce kredi paketi alın.");
  return lot.id;
}

// ---------------------------------------------------------------------------
// Satın alma ve ödeme
// ---------------------------------------------------------------------------

export async function createCreditPurchase(studentId: string, credits: number, couponCode?: string | null) {
  if (!salesOpen()) throw new CreditError("Online ödeme altyapımız çok yakında açılıyor; şu an kredi satışı yapılamıyor.");
  const settings = await loadSettings();
  const packages = parsePackages(settings.questionPackages);
  const pack = packages.find((p) => p.credits === credits);
  if (!pack) throw new CreditError("Seçtiğiniz paket bulunamadı.");
  const student = await db.user.findUnique({ where: { id: studentId }, select: { role: true, email: true } });
  if (student?.role !== "STUDENT") throw new CreditError("Kredi yalnızca veli/öğrenci hesabıyla alınabilir.");
  if (!student.email) throw new CreditError("Ödeme için hesabınızda e-posta adresi olmalı.");
  // Kredi satışı platformundur: indirim tutarın tamamından düşebilir (en az 1 ₺ ödenir).
  const discount = await resolveDiscount(studentId, couponCode, "credits", pack.price, pack.price).catch((error: unknown) => {
    if (error instanceof DiscountError) throw new CreditError(error.message);
    throw error;
  });
  return db.creditPurchase.create({
    data: { code: newCode("KR"), studentId, credits: pack.credits, price: pack.price - discount.amount, singlePrice: singleQuestionPrice(packages), discountAmount: discount.amount, couponCode: discount.couponCode },
  });
}

/** Kredi paketi için ödeme sayfasını başlatır (ders ödemesiyle aynı sağlayıcı). */
export async function startCreditCheckout(purchaseId: string, studentId: string, ipAddress: string): Promise<string> {
  const purchase = await db.creditPurchase.findUnique({ where: { id: purchaseId }, include: { student: { include: { studentProfile: { include: { city: true } } } } } });
  if (!purchase || purchase.studentId !== studentId) throw new CreditError("Satın alma bulunamadı.");
  if (purchase.status !== "PENDING_PAYMENT") throw new CreditError("Bu paket için ödeme beklenmiyor.");
  const provider = getPaymentProvider();
  const payment = await db.payment.create({ data: { creditPurchaseId: purchase.id, provider: provider.id, amount: purchase.price } });
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: purchase.id,
      bookingCode: purchase.code,
      amount: purchase.price,
      description: `Soru kredisi (${purchase.credits} soru)`,
      buyer: {
        id: purchase.studentId,
        firstName: purchase.student.firstName,
        lastName: purchase.student.lastName,
        email: purchase.student.email!,
        phone: purchase.student.phone,
        ipAddress,
        city: purchase.student.studentProfile?.city?.name ?? null,
        registeredAt: purchase.student.createdAt,
      },
      // Platform satışı: alt üye işyerine pay aktarılmaz
      teacher: { subMerchantKey: null, amount: 0 },
      callbackUrl: appUrl(`/api/odeme/${provider.id}/donus`),
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerToken: session.token } });
    return session.redirectUrl;
  } catch (error) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: String(error).slice(0, 300) } });
    throw new CreditError("Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar deneyin.");
  }
}

/** Ödeme kuruluşundan dönüşte kredi paketini sonuçlandırır (tekrar çağrılabilir). */
export async function completeCreditCheckout(
  payment: { id: string; provider: string; amount: number; status: string; creditPurchaseId: string | null; providerToken: string | null },
  now = new Date(),
): Promise<"paid" | "failed" | "already" | "pending"> {
  if (!payment.creditPurchaseId || !payment.providerToken) return "failed";
  if (payment.status !== "INITIATED") return "already";
  const result = await getProviderById(payment.provider).retrieveResult(payment.providerToken);
  if (result.status === "pending") return "pending";
  const raw = (result.raw ?? undefined) as Prisma.InputJsonValue | undefined;
  if (result.status === "failure") {
    await db.payment.updateMany({ where: { id: payment.id, status: "INITIATED" }, data: { status: "FAILED", failureReason: result.reason.slice(0, 300), raw } });
    await db.creditPurchase.updateMany({ where: { id: payment.creditPurchaseId, status: "PENDING_PAYMENT" }, data: { status: "FAILED" } });
    return "failed";
  }
  const settings = await loadSettings();
  return db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: "INITIATED" },
      data: { status: "SUCCEEDED", providerPaymentId: result.providerPaymentId, providerItemId: result.providerItemId, raw },
    });
    if (updated.count === 0) return "already";
    const purchase = await tx.creditPurchase.findUniqueOrThrow({ where: { id: payment.creditPurchaseId! } });
    if (result.paidAmount !== purchase.price) throw new CreditError("Ödenen tutar paket fiyatıyla uyuşmuyor.");
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + settings.creditValidityMonths);
    await tx.creditPurchase.update({ where: { id: purchase.id }, data: { status: "PAID", paidAt: now, expiresAt } });
    await tx.creditLedger.create({ data: { studentId: purchase.studentId, purchaseId: purchase.id, kind: "PURCHASE", amount: purchase.credits, note: `${purchase.code} satın alındı` } });
    await recordPaidOrder(tx, { userId: purchase.studentId, targetType: "credits", targetId: purchase.id, discountAmount: purchase.discountAmount, couponCode: purchase.couponCode });
    await notify(
      { userId: purchase.studentId, type: "credits.purchased", title: `${purchase.credits} soru kredisi hesabınızda`, body: `${formatMoney(purchase.price)} ödemeniz alındı. Sorularınızı “Soru sor” sayfasından gönderebilirsiniz.`, link: "/soru-sor" },
      tx,
    );
    return "paid";
  });
}

/** İade önizlemesi: süre içinde, kullanılmayan kredi kadar (kullanılanlar tek soru fiyatından düşülür). */
export async function refundPreview(purchase: CreditPurchase, settings: SiteSettings, now = new Date(), tx: Tx = db) {
  if (purchase.status !== "PAID" || !purchase.paidAt) return { allowed: false as const, reason: "Bu paket iade edilemez." };
  if (now.getTime() - purchase.paidAt.getTime() > settings.creditRefundDays * 86_400_000) return { allowed: false as const, reason: `İade süresi (${settings.creditRefundDays} gün) doldu.` };
  const used = await usedCredits(purchase.id, tx);
  // Sonucu henüz kesinleşmeyen soru (çözülmedi, itiraz açık ya da itiraz süresi sürüyor) varken iade yapılmaz.
  const open = await tx.poolQuestion.count({
    where: { purchaseId: purchase.id, OR: [{ status: { in: ["OPEN", "CLAIMED", "DISPUTED"] } }, { status: "ANSWERED", disputeUntil: { gt: now } }] },
  });
  if (open) return { allowed: false as const, reason: "Bu paketten gönderilen ve sonucu henüz kesinleşmeyen sorunuz var; sonuçlanınca iade isteyebilirsiniz." };
  const amount = refundableAmount(purchase, used);
  if (amount <= 0) return { allowed: false as const, reason: "Kullanılan krediler düşüldükten sonra iade edilecek tutar kalmıyor." };
  return { allowed: true as const, amount, used };
}

/** Öğrencinin iade talebi: kalan krediler silinir, iade ödeme kuruluşuna iletilir. */
export async function refundCreditPurchase(purchaseId: string, studentId: string, now = new Date()) {
  const settings = await loadSettings();
  let refundId: string | null = null;
  let amount = 0;
  await db.$transaction(async (tx) => {
    await lockStudentCredits(tx, studentId);
    const purchase = await tx.creditPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase || purchase.studentId !== studentId) throw new CreditError("Satın alma bulunamadı.");
    const preview = await refundPreview(purchase, settings, now, tx);
    if (!preview.allowed) throw new CreditError(preview.reason);
    amount = preview.amount;
    const remaining = (await tx.creditLedger.aggregate({ where: { purchaseId }, _sum: { amount: true } }))._sum.amount ?? 0;
    if (remaining > 0) await tx.creditLedger.create({ data: { studentId, purchaseId, kind: "REFUND", amount: -remaining, note: "İade edildi" } });
    const payment = await tx.payment.findFirst({ where: { creditPurchaseId: purchaseId, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } });
    if (!payment) throw new CreditError("Ödeme kaydı bulunamadı.");
    refundId = (await tx.refund.create({ data: { paymentId: payment.id, amount, reason: `Soru kredisi iadesi (${preview.used} kredi kullanıldı)` } })).id;
    await tx.creditPurchase.update({
      where: { id: purchaseId },
      data: { refundedAmount: { increment: amount }, status: amount >= purchase.price ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    });
  });
  if (refundId) await processRefund(refundId);
  return amount;
}

/** Süresi dolan paketlerin kalan kredilerini düşer (zamanlayıcı). */
export async function expireCredits(now = new Date()): Promise<number> {
  // Yalnızca kalan kredisi olan paketler (bakiyesi sıfırlananlar her turda yeniden taranmaz)
  const lots = await db.$queryRaw<{ id: string; studentId: string }[]>`
    SELECT p."id", p."studentId" FROM "CreditPurchase" p
    JOIN "CreditLedger" l ON l."purchaseId" = p."id"
    WHERE p."status" IN ('PAID', 'PARTIALLY_REFUNDED') AND p."expiresAt" <= ${now}
    GROUP BY p."id", p."studentId" HAVING SUM(l."amount") > 0
    LIMIT 200`;
  let expired = 0;
  for (const lot of lots) {
    await db.$transaction(async (tx) => {
      await lockStudentCredits(tx, lot.studentId);
      const remaining = (await tx.creditLedger.aggregate({ where: { purchaseId: lot.id }, _sum: { amount: true } }))._sum.amount ?? 0;
      if (remaining > 0) {
        await tx.creditLedger.create({ data: { studentId: lot.studentId, purchaseId: lot.id, kind: "EXPIRE", amount: -remaining, note: "Kullanım süresi doldu" } });
        expired++;
      }
    });
  }
  return expired;
}

/** Ödeme bekleyen ve 1 saati geçen satın almaları kapatır. */
export async function expireStalePurchases(now = new Date()): Promise<number> {
  const result = await db.creditPurchase.updateMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - 3_600_000) } }, data: { status: "EXPIRED" } });
  return result.count;
}

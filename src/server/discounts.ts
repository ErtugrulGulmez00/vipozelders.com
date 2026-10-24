import { randomInt } from "node:crypto";
import type { Coupon } from "@/generated/prisma/client";
import { formatMoney } from "@/lib/money";
import { db, type DbTransaction } from "./db";
import { notify } from "./notifications";
import { loadSettings } from "./settings";

// İndirim kodları ve "arkadaşını getir". İndirim platformun hizmet bedelinden karşılanır: öğretmen payı değişmez,
// indirim en fazla hizmet bedeli kadar olur (soru kredisinde satış platformundur; en az 1 ₺ ödenir).
// Kod girilmezse ve kullanıcı davetle geldiyse ilk siparişinde davet indirimi uygulanır. Kullanım, ödeme
// başarıyla tamamlandığında kaydedilir; davet edene ödül (soru kredisi) aynı anda verilir.

export class DiscountError extends Error {}

export type DiscountTarget = "booking" | "credits" | "subscription" | "group";
export type Discount = { amount: number; couponCode: string | null; source: "coupon" | "referral" | null; label: string | null };

type Tx = DbTransaction | typeof db;

const NONE: Discount = { amount: 0, couponCode: null, source: null, label: null };
const MIN_PAYABLE = 100;

export const TARGET_LABELS: Record<DiscountTarget, string> = { booking: "Birebir ders", credits: "Soru kredisi", subscription: "Soru aboneliği", group: "Grup dersi" };

/**
 * Kodlar büyük harfle saklanır ve karşılaştırılır. "hosgeldin" Türkçe kurala göre "HOSGELDİN" olur, İngilizce klavyeyle
 * yazılan "HOSGELDIN" ile eşleşmez; bu yüzden noktalı/noktasız I ayrımı yapılmaz (İ ve ı → I).
 */
export function normalizeCode(code: string) {
  return code.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "").replace(/[İı]/g, "I");
}

/** Kullanıcının daha önce ödenmiş bir siparişi var mı (ilk sipariş indirimleri için)? */
export async function hasPaidOrder(userId: string, tx: Tx = db) {
  const [bookings, credits, subs, groups] = await Promise.all([
    tx.booking.count({ where: { studentId: userId, paidAt: { not: null } } }),
    tx.creditPurchase.count({ where: { studentId: userId, paidAt: { not: null }, price: { gt: 0 } } }),
    tx.questionSubscription.count({ where: { studentId: userId, paidAt: { not: null } } }),
    tx.groupEnrollment.count({ where: { studentId: userId, paidAt: { not: null } } }),
  ]);
  return bookings + credits + subs + groups > 0;
}

function cap(amount: number, target: DiscountTarget, price: number, commission: number) {
  const limit = target === "credits" ? price - MIN_PAYABLE : commission;
  return Math.max(0, Math.min(amount, limit));
}

async function couponProblem(coupon: Coupon, userId: string, target: DiscountTarget, price: number, now: Date): Promise<string | null> {
  if (!coupon.isActive || (coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt <= now)) return "Bu indirim kodunun süresi dolmuş ya da henüz başlamamış.";
  if (coupon.targets.length && !coupon.targets.includes(target)) return `Bu kod ${coupon.targets.map((t) => TARGET_LABELS[t as DiscountTarget] ?? t).join(", ")} için geçerli.`;
  if (coupon.minAmount && price < coupon.minAmount) return `Bu kod ${formatMoney(coupon.minAmount)} ve üzeri siparişlerde geçerli.`;
  if (coupon.maxUses !== null && (await db.couponRedemption.count({ where: { couponId: coupon.id } })) >= coupon.maxUses) return "Bu indirim kodunun kullanım hakkı doldu.";
  if ((await db.couponRedemption.count({ where: { couponId: coupon.id, userId } })) >= coupon.perUserLimit) return "Bu indirim kodunu daha önce kullandınız.";
  if (coupon.firstOrderOnly && (await hasPaidOrder(userId))) return "Bu kod yalnızca ilk siparişte geçerli.";
  return null;
}

/**
 * Sipariş için indirim: kod verildiyse kod (geçersizse hata), verilmediyse uygunsa davet indirimi.
 * price: indirimsiz tutar; commission: platformun hizmet bedeli (indirim bundan karşılanır).
 */
export async function resolveDiscount(userId: string, code: string | null | undefined, target: DiscountTarget, price: number, commission: number, now = new Date()): Promise<Discount> {
  if (price <= 0) return NONE;
  const normalized = code ? normalizeCode(code) : "";
  if (normalized) {
    const coupon = await db.coupon.findUnique({ where: { code: normalized } });
    if (!coupon) throw new DiscountError("İndirim kodu bulunamadı.");
    const problem = await couponProblem(coupon, userId, target, price, now);
    if (problem) throw new DiscountError(problem);
    const raw = coupon.kind === "PERCENT" ? Math.floor((price * coupon.value) / 100) : coupon.value;
    const amount = cap(coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw, target, price, commission);
    if (amount <= 0) throw new DiscountError("Bu siparişte bu kodla indirim uygulanamıyor.");
    return { amount, couponCode: coupon.code, source: "coupon", label: `${coupon.code} indirimi` };
  }
  const settings = await loadSettings();
  if (!settings.referralEnabled || settings.referralDiscountPercent <= 0) return NONE;
  const user = await db.user.findUnique({ where: { id: userId }, select: { referredById: true } });
  if (!user?.referredById || (await hasPaidOrder(userId))) return NONE;
  const amount = cap(Math.floor((price * settings.referralDiscountPercent) / 100), target, price, commission);
  return amount > 0 ? { amount, couponCode: null, source: "referral", label: `Arkadaş davetiyle %${settings.referralDiscountPercent} indirim` } : NONE;
}

/**
 * Ödeme başarıyla tamamlandığında (transaction içinde): indirim kullanımı kaydedilir; kullanıcı davetle geldiyse ve
 * ilk ödemesiyse davet edene soru kredisi verilir.
 */
export async function recordPaidOrder(tx: DbTransaction, input: { userId: string; targetType: DiscountTarget; targetId: string; discountAmount: number; couponCode: string | null }) {
  if (input.discountAmount > 0) {
    const coupon = input.couponCode ? await tx.coupon.findUnique({ where: { code: input.couponCode }, select: { id: true } }) : null;
    await tx.couponRedemption.upsert({
      where: { targetType_targetId: { targetType: input.targetType, targetId: input.targetId } },
      create: { couponId: coupon?.id ?? null, userId: input.userId, source: input.couponCode ? "coupon" : "referral", amount: input.discountAmount, targetType: input.targetType, targetId: input.targetId },
      update: {},
    });
  }
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { referredById: true, referralRewardedAt: true, firstName: true } });
  if (!user?.referredById || user.referralRewardedAt) return;
  const marked = await tx.user.updateMany({ where: { id: input.userId, referralRewardedAt: null }, data: { referralRewardedAt: new Date() } });
  if (marked.count !== 1) return;
  const settings = await loadSettings();
  if (!settings.referralEnabled || settings.referralRewardCredits <= 0) return;
  const referrer = await tx.user.findUnique({ where: { id: user.referredById }, select: { id: true, role: true, status: true } });
  if (!referrer || referrer.role !== "STUDENT" || referrer.status !== "ACTIVE") return;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + settings.creditValidityMonths);
  // Ödül: ücretsiz kredi paketi (iade edilecek tutarı yoktur)
  const purchase = await tx.creditPurchase.create({
    data: { code: `DV-${randomCode()}`, studentId: referrer.id, credits: settings.referralRewardCredits, price: 0, singlePrice: 0, status: "PAID", paidAt: now, expiresAt },
  });
  await tx.creditLedger.create({ data: { studentId: referrer.id, purchaseId: purchase.id, kind: "PURCHASE", amount: settings.referralRewardCredits, note: "Arkadaş daveti ödülü" } });
  await notify({ userId: referrer.id, type: "referral.reward", title: `${settings.referralRewardCredits} soru kredisi kazandınız`, body: `Davet ettiğiniz ${user.firstName} ilk siparişini verdi. Kredileriniz hesabınızda; sorularınızı “Soru sor” sayfasından gönderebilirsiniz.`, link: "/hesabim/krediler" }, tx);
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Kullanıcının kişisel davet kodu (yoksa üretilir). */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (user.referralCode) return user.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(7);
    const updated = await db.user.updateMany({ where: { id: userId, referralCode: null }, data: { referralCode: code } }).catch(() => ({ count: 0 }));
    if (updated.count === 1) return code;
    const again = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (again.referralCode) return again.referralCode;
  }
  throw new Error("Davet kodu üretilemedi.");
}

/** Kayıtta davet kodu: geçerliyse davet edenin kimliği. */
export async function referrerForCode(code: string | null | undefined): Promise<string | null> {
  const normalized = code ? normalizeCode(code) : "";
  if (!normalized) return null;
  const referrer = await db.user.findUnique({ where: { referralCode: normalized }, select: { id: true, role: true, status: true } });
  return referrer && referrer.role === "STUDENT" && referrer.status === "ACTIVE" ? referrer.id : null;
}

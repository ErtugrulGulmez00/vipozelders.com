import { randomInt } from "node:crypto";
import { db, type DbTransaction } from "./db";
import { loadSettings } from "./settings";

// "Arkadaşını getir". İndirim platformun hizmet bedelinden karşılanır: öğretmen payı değişmez,
// indirim en fazla hizmet bedeli kadar olur.
// Davetle gelen kullanıcının ilk siparişinde uygulanır. Kullanım, ödeme
// başarıyla tamamlandığında kaydedilir.

export class DiscountError extends Error {}

export type DiscountTarget = "booking" | "group";
export type Discount = { amount: number; couponCode: string | null; source: "referral" | null; label: string | null };

type Tx = DbTransaction | typeof db;

const NONE: Discount = { amount: 0, couponCode: null, source: null, label: null };

/**
 * Kodlar büyük harfle saklanır ve karşılaştırılır. "hosgeldin" Türkçe kurala göre "HOSGELDİN" olur, İngilizce klavyeyle
 * yazılan "HOSGELDIN" ile eşleşmez; bu yüzden noktalı/noktasız I ayrımı yapılmaz (İ ve ı → I).
 */
export function normalizeCode(code: string) {
  return code.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "").replace(/[İı]/g, "I");
}

/** Kullanıcının daha önce ödenmiş bir siparişi var mı (ilk sipariş indirimleri için)? */
export async function hasPaidOrder(userId: string, tx: Tx = db) {
  const [bookings, groups] = await Promise.all([
    tx.booking.count({ where: { studentId: userId, paidAt: { not: null } } }),
    tx.groupEnrollment.count({ where: { studentId: userId, paidAt: { not: null } } }),
  ]);
  return bookings + groups > 0;
}

export type DiscountExclude = { target: DiscountTarget; id: string };

/**
 * Ödemesi tamamlanmamış, indirimli siparişler (kod ya da davet indirimi). Kullanım ödeme bitince kaydedildiği için
 * bunlar da kullanım sayılır: aynı kodla aynı anda birden fazla sipariş açıp hepsini indirimli ödemek engellenir.
 * userId verilmezse herkesinki (kodun toplam kullanım hakkı için); exclude: yeniden başlatılan aynı sipariş.
 */
async function openDiscountedOrders(couponCode: string | null, userId: string | null, exclude?: DiscountExclude, now = new Date()) {
  const base = { discountAmount: { gt: 0 }, couponCode, ...(userId ? { studentId: userId } : {}) };
  const not = (target: DiscountTarget) => (exclude?.target === target ? { id: { not: exclude.id } } : {});
  const counts = await Promise.all([
    db.booking.count({ where: { ...base, ...not("booking"), status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } } }),
    db.groupEnrollment.count({ where: { ...base, ...not("group"), status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } } }),
  ]);
  return counts.reduce((t, n) => t + n, 0);
}

function cap(amount: number, commission: number) {
  return Math.max(0, Math.min(amount, commission));
}

/**
 * Sipariş için davet indirimi (uygunsa).
 * price: indirimsiz tutar; commission: platformun hizmet bedeli (indirim bundan karşılanır).
 */
export async function resolveDiscount(
  userId: string,
  target: DiscountTarget,
  price: number,
  commission: number,
  now = new Date(),
  exclude?: DiscountExclude,
): Promise<Discount> {
  if (price <= 0) return NONE;
  const settings = await loadSettings();
  if (!settings.referralEnabled || settings.referralDiscountPercent <= 0) return NONE;
  const user = await db.user.findUnique({ where: { id: userId }, select: { referredById: true } });
  // Davet indirimi yalnızca ilk sipariş için: ödemesi süren başka davet indirimli sipariş varsa ikincisine uygulanmaz
  if (!user?.referredById || (await hasPaidOrder(userId)) || (await openDiscountedOrders(null, userId, exclude, now)) > 0) return NONE;
  const amount = cap(Math.floor((price * settings.referralDiscountPercent) / 100), commission);
  return amount > 0 ? { amount, couponCode: null, source: "referral", label: `Arkadaş davetiyle %${settings.referralDiscountPercent} indirim` } : NONE;
}

/**
 * Ödeme başarıyla tamamlandığında (transaction içinde): indirim kullanımı kaydedilir.
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

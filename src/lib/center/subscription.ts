import { addMonths } from "date-fns";

// Kurum aboneliğinin o anki durumu: deneme / aktif / ödeme gecikmesi (ek süre) / süresi doldu / askıda.

export type CenterAccessState = "trial" | "active" | "grace" | "expired" | "suspended";

export type CenterAccess = {
  state: CenterAccessState;
  /** Kayıt ekleyip değiştirebilir mi (süresi dolan panel salt okunur olur) */
  writable: boolean;
  /** Personel panele girebilir mi (askıya alınan kurumda hayır) */
  canLogin: boolean;
  endsAt: Date | null;
  /** Bitişe kalan gün (geçmişse negatif) */
  daysLeft: number | null;
};

/** Ödeme günü geçtikten sonra panelin yazılabilir kaldığı süre. */
export const GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

export function centerAccess(
  center: { status: "TRIAL" | "ACTIVE" | "SUSPENDED"; trialEndsAt: Date | null; paidUntil: Date | null },
  now = new Date(),
): CenterAccess {
  if (center.status === "SUSPENDED") return { state: "suspended", writable: false, canLogin: false, endsAt: null, daysLeft: null };
  const trial = center.status === "TRIAL";
  const endsAt = trial ? center.trialEndsAt : center.paidUntil;
  if (!endsAt) return { state: trial ? "trial" : "active", writable: true, canLogin: true, endsAt: null, daysLeft: null };
  const msLeft = endsAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  if (msLeft > 0) return { state: trial ? "trial" : "active", writable: true, canLogin: true, endsAt, daysLeft };
  if (!trial && -msLeft < GRACE_DAYS * DAY_MS) return { state: "grace", writable: true, canLogin: true, endsAt, daysLeft };
  return { state: "expired", writable: false, canLogin: true, endsAt, daysLeft };
}

/** Ödenen ay sayısı kadar süreyi uzatır: süre bitmemişse bitişin üzerine, bitmişse bugünden başlar. */
export function extendSubscription(paidUntil: Date | null, months: number, now = new Date()): { periodStart: Date; periodEnd: Date } {
  const periodStart = paidUntil && paidUntil.getTime() > now.getTime() ? paidUntil : now;
  return { periodStart, periodEnd: addMonths(periodStart, months) };
}

// Pi Koç: bireysel koçların öğrenci takip paneli. Kademeler site ayarından gelir: "öğrenci:aylık TL", virgülle ayrılmış.

export type CoachTier = { students: number; priceTl: number };

/** "3:299,5:449" → [{ students: 3, priceTl: 299 }, …]. Hatalı parçalar atlanır, aynı öğrenci sayısının sonuncusu geçerlidir. */
export function parseCoachTiers(text: string): CoachTier[] {
  const tiers = text
    .split(/[,\n]+/)
    .map((part) => part.trim().split(":").map((n) => Number(n.trim())))
    .filter(([students, price]) => Number.isInteger(students) && students > 0 && students <= 1000 && Number.isInteger(price) && price > 0 && price <= 1_000_000)
    .map(([students, priceTl]) => ({ students, priceTl }));
  const unique = new Map(tiers.map((t) => [t.students, t]));
  return [...unique.values()].sort((a, b) => a.students - b.students);
}

/** Öğrenci sınırına karşılık gelen aylık fiyat (özel bir sınır verilmişse null). */
export function coachPriceFor(tiers: CoachTier[], students: number): number | null {
  return tiers.find((t) => t.students === students)?.priceTl ?? null;
}

// ——— Paket durumu ———
// Ücretsiz paket süresizdir (az öğrenci, temel özellikler). Ücretli paket ödeme süresi boyunca açıktır; süre bitince
// hesap ücretsiz pakete düşer (kayıtlar silinmez). Eski hesaplardaki deneme süresi bitene kadar ücretli gibi sayılır.

export type CoachPlanState = "free" | "paid" | "trial";

export type CoachPlan = {
  state: CoachPlanState;
  /** Ücretli özellikler açık mı (ücretli paket ya da süren eski deneme) */
  paid: boolean;
  /** Şu an geçerli öğrenci sınırı */
  studentLimit: number;
  /** Ücretli paketin öğrenci sınırı (ücretsizdeyken: ödeme gelince açılacak sınır) */
  paidLimit: number;
  /** Ücretli paketin ya da denemenin bitişi */
  endsAt: Date | null;
  daysLeft: number | null;
};

/** Ödeme günü geçtikten sonra ücretli özelliklerin açık kaldığı süre (kurum paneliyle aynı). */
export const COACH_GRACE_DAYS = 7;

export function coachPlan(
  center: { status: "TRIAL" | "ACTIVE" | "SUSPENDED"; trialEndsAt: Date | null; paidUntil: Date | null; studentLimit: number },
  freeStudents: number,
  now = new Date(),
): CoachPlan {
  const free: CoachPlan = { state: "free", paid: false, studentLimit: freeStudents, paidLimit: center.studentLimit, endsAt: null, daysLeft: null };
  const days = (end: Date) => Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  if (center.status === "TRIAL") {
    // Eski hesap: bitişi olmayan deneme yönetimin açık bıraktığı hesaptır
    if (!center.trialEndsAt) return { state: "trial", paid: true, studentLimit: center.studentLimit, paidLimit: center.studentLimit, endsAt: null, daysLeft: null };
    if (center.trialEndsAt.getTime() > now.getTime()) return { state: "trial", paid: true, studentLimit: center.studentLimit, paidLimit: center.studentLimit, endsAt: center.trialEndsAt, daysLeft: days(center.trialEndsAt) };
    return free;
  }
  if (center.status === "ACTIVE" && center.paidUntil && center.paidUntil.getTime() + COACH_GRACE_DAYS * 86_400_000 > now.getTime()) {
    return { state: "paid", paid: true, studentLimit: Math.max(center.studentLimit, freeStudents), paidLimit: center.studentLimit, endsAt: center.paidUntil, daysLeft: days(center.paidUntil) };
  }
  return free;
}

/** Paketin kısa adı: "Ücretsiz paket · 3 öğrenci" / "10 öğrenci paketi". */
export function coachPlanLabel(plan: CoachPlan): string {
  if (plan.state === "free") return `Ücretsiz paket · ${plan.studentLimit} öğrenciye kadar`;
  return `${plan.studentLimit} öğrenci paketi${plan.state === "trial" ? " (deneme)" : ""}`;
}

// ——— Görüntülü görüşme sınırı ———
// Aylık havuz = paket öğrenci sayısı × saat (ayar). Ücretsiz pakette sert: görüşme başına dakika sınırı ve havuz dolunca
// yeni görüşme açılmaz. Ücretli pakette yumuşak: süre serbest, havuz aşılınca yalnızca uyarı ve bildirim.

export type MeetingPolicy = { poolMinutes: number; hard: boolean; maxMeetingMinutes: number | null };

export function meetingPolicy(plan: CoachPlan, settings: { piKocFreeStudents: number; piKocHoursPerStudent: number; piKocFreeMeetingMinutes: number }): MeetingPolicy {
  const students = plan.paid ? plan.paidLimit : settings.piKocFreeStudents;
  return { poolMinutes: students * settings.piKocHoursPerStudent * 60, hard: !plan.paid, maxMeetingMinutes: plan.paid ? null : settings.piKocFreeMeetingMinutes };
}

/** Ücretli pakette bir görüşmenin en uzun süresi (anahtar süresi; uzun ders için yeniden girilebilir). */
export const PAID_MEETING_MINUTES = 120;

export type MeetingAllowance = { ok: true; minutes: number; overPool: boolean } | { ok: false; reason: string };

/** Görüşmeye girerken: bu ay kullanılan dakikaya göre izin ve anahtar süresi. */
export function meetingAllowance(policy: MeetingPolicy, usedMinutes: number): MeetingAllowance {
  const left = policy.poolMinutes - usedMinutes;
  if (!policy.hard) return { ok: true, minutes: PAID_MEETING_MINUTES, overPool: left <= 0 };
  if (left < 1) {
    return { ok: false, reason: `Ücretsiz paketin bu ayki görüntülü görüşme süresi (${formatHours(policy.poolMinutes)}) doldu. Ücretli pakete geçerek görüşmeye devam edebilirsiniz.` };
  }
  return { ok: true, minutes: Math.min(policy.maxMeetingMinutes ?? PAID_MEETING_MINUTES, Math.floor(left)), overPool: false };
}

/** 750 → "12 sa 30 dk", 720 → "12 saat", 45 → "45 dk". */
export function formatHours(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (!h) return `${rest} dk`;
  return rest ? `${h} sa ${rest} dk` : `${h} saat`;
}

/** Görüşme kayıtlarının bu aydaki toplam dakikası (açık görüşme şu ana kadar sayılır; ay başından önceki kısım sayılmaz). */
export function meetingMinutes(meetings: { startedAt: Date; endedAt: Date | null }[], monthStart: Date, now: Date): number {
  let total = 0;
  for (const m of meetings) {
    const start = Math.max(m.startedAt.getTime(), monthStart.getTime());
    const end = (m.endedAt ?? now).getTime();
    if (end > start) total += (end - start) / 60_000;
  }
  return total;
}

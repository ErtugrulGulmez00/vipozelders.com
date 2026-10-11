// Fiyat, komisyon ve iade hesapları. Saf fonksiyonlar: veritabanına dokunmaz, test edilebilir.

export const ALLOWED_DURATIONS = [30, 45, 60, 90, 120] as const;

/** Saatlik ücretten ders ücreti; tam liraya yuvarlanır (kuruş). */
export function lessonPrice(hourlyPrice: number, durationMinutes: number): number {
  return Math.round((hourlyPrice * durationMinutes) / 60 / 100) * 100;
}

export function splitCommission(price: number, commissionRateBps: number) {
  const commissionAmount = Math.round((price * commissionRateBps) / 10000);
  return { commissionAmount, teacherAmount: price - commissionAmount };
}

export type CancellationPolicy = {
  fullRefundHours: number;
  partialRefundHours: number;
  partialRefundPercent: number;
};

/** Onaylanmış dersi öğrenci iptal ettiğinde iade edilecek tutar. */
export function studentCancellationRefund(price: number, startAt: Date, now: Date, policy: CancellationPolicy) {
  const hoursLeft = (startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft >= policy.fullRefundHours) {
    return { refundAmount: price, refundPercent: 100 };
  }
  if (hoursLeft >= policy.partialRefundHours) {
    return {
      refundAmount: Math.round((price * policy.partialRefundPercent) / 100),
      refundPercent: policy.partialRefundPercent,
    };
  }
  return { refundAmount: 0, refundPercent: 0 };
}

/** İade sonrası kalan tutar platform ile öğretmen arasında komisyon oranında paylaştırılır. */
export function splitRetained(price: number, commissionAmount: number, refundAmount: number) {
  const retained = Math.max(0, price - refundAmount);
  if (retained === 0 || price === 0) return { retained: 0, commission: 0, teacher: 0 };
  const commission = Math.round((commissionAmount * retained) / price);
  return { retained, commission, teacher: retained - commission };
}

/** Öğretmenin onay için son anı: ödemeden itibaren pencere, ama dersten belirli süre önce. */
export function approvalDeadline(
  paidAt: Date,
  startAt: Date,
  settings: { approvalWindowHours: number; approvalMinHoursBeforeStart: number },
): Date {
  const byWindow = paidAt.getTime() + settings.approvalWindowHours * 3_600_000;
  const byStart = startAt.getTime() - settings.approvalMinHoursBeforeStart * 3_600_000;
  const deadline = Math.min(byWindow, byStart);
  // Ders çok yakınsa en azından ders başlayana kadar süre tanınır.
  return new Date(deadline > paidAt.getTime() + 15 * 60_000 ? deadline : startAt.getTime());
}

/**
 * Sıralama için ağırlıklı puan: az yorumlu öğretmenleri ortalamaya doğru çeker.
 * (Tek yorumlu 5 yıldız, çok yorumlu 4,9'un önüne geçemez.)
 */
export function weightedRating(average: number, count: number, prior = 4.2, weight = 5): number {
  return (prior * weight + average * count) / (weight + count);
}

import type { Booking, CreditPurchase, QuestionSubscription } from "@/generated/prisma/client";
import { formatLessonRange } from "@/lib/dates";

/** Ödemenin neye ait olduğu: ders randevusu, soru kredisi paketi ya da soru aboneliği. Ödeme ve sonuç sayfaları bunu gösterir. */
export type PaymentSubject = {
  kind: "booking" | "credits" | "subscription";
  ownerId: string;
  /** /odeme/sonuc/[id] sayfasının kimliği */
  resultId: string;
  code: string;
  title: string;
  detail: string;
  holdExpiresAt: Date | null;
};

export function paymentSubject(payment: { booking: Booking | null; creditPurchase: CreditPurchase | null; subscription?: QuestionSubscription | null }): PaymentSubject | null {
  const { booking, creditPurchase, subscription } = payment;
  if (booking) {
    return {
      kind: "booking",
      ownerId: booking.studentId,
      resultId: booking.id,
      code: booking.code,
      title: `${booking.levelName} ${booking.subjectName} · ${booking.serviceName}`,
      detail: booking.mode === "QUESTION" ? "Fotoğrafla soru (saat yok)" : formatLessonRange(booking.startAt, booking.endAt),
      holdExpiresAt: booking.holdExpiresAt,
    };
  }
  if (creditPurchase) {
    return {
      kind: "credits",
      ownerId: creditPurchase.studentId,
      resultId: creditPurchase.id,
      code: creditPurchase.code,
      title: `${creditPurchase.credits} soru kredisi`,
      detail: "Soru çözüm paketi",
      holdExpiresAt: null,
    };
  }
  if (subscription) {
    return {
      kind: "subscription",
      ownerId: subscription.studentId,
      resultId: subscription.id,
      code: subscription.code,
      title: `${subscription.levelName} ${subscription.subjectName} soru aboneliği`,
      detail: `${subscription.days} gün · günde ${subscription.dailyLimit} soruya kadar`,
      holdExpiresAt: null,
    };
  }
  return null;
}

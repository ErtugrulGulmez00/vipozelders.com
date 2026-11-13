import type { ReviewStatus } from "@/generated/prisma/client";
import { maskContacts } from "@/lib/text";
import { db, type DbTransaction } from "./db";
import { notify } from "./notifications";
import { loadSettings } from "./settings";

export class ReviewError extends Error {}

/** Yorum hakkı veren görüntülü görüşmenin en kısa süresi (dakika). */
export const REVIEW_MIN_MEETING_MINUTES = 15;

/**
 * Öğrenci/veli bu öğretmeni değerlendirebilir mi?
 * Eski model: süresi dolmamış, tamamlanmış bir randevu. Yeni model: kabul edilmiş ders talebi ve öğretmenle
 * Pi Koç'ta birlikte yapılmış en az 15 dakikalık görüntülü görüşme.
 */
export async function reviewEligibility(studentId: string, teacherId: string, now = new Date()) {
  const settings = await loadSettings();
  const since = new Date(now.getTime() - settings.reviewWindowDays * 24 * 3_600_000);
  const [lastCompleted, existing, inquiries] = await Promise.all([
    db.booking.findFirst({
      where: { studentId, teacherId, status: "COMPLETED", isTest: false, isIntro: false, completedAt: { gte: since } },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    }),
    db.review.findUnique({ where: { teacherId_studentId: { teacherId, studentId } } }),
    db.teacherInquiry.findMany({ where: { teacherId, requesterId: studentId, status: "ACCEPTED", centerStudentId: { not: null } }, select: { id: true, centerStudentId: true }, orderBy: { createdAt: "desc" } }),
  ]);
  if (lastCompleted) return { eligible: true, bookingId: lastCompleted.id, inquiryId: null, existing };
  const inquiryId = await inquiryWithMeeting(inquiries);
  return { eligible: Boolean(inquiryId), bookingId: null, inquiryId, existing };
}

/** Öğrencisiyle en az 15 dakikalık ortak görüşme yapılmış ilk talep. */
async function inquiryWithMeeting(inquiries: { id: string; centerStudentId: string | null }[]): Promise<string | null> {
  const ids = inquiries.map((q) => q.centerStudentId).filter((id): id is string => Boolean(id));
  if (!ids.length) return null;
  const meetings = await db.coachMeeting.findMany({ where: { studentId: { in: ids }, peakCount: { gte: 2 }, endedAt: { not: null } }, select: { studentId: true, startedAt: true, endedAt: true } });
  const met = new Set(meetings.filter((m) => m.endedAt!.getTime() - m.startedAt.getTime() >= REVIEW_MIN_MEETING_MINUTES * 60_000).map((m) => m.studentId));
  return inquiries.find((q) => q.centerStudentId && met.has(q.centerStudentId))?.id ?? null;
}

export async function recomputeTeacherRating(tx: DbTransaction | typeof db, teacherId: string) {
  const stats = await tx.review.aggregate({
    where: { teacherId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  await tx.teacherProfile.update({
    where: { userId: teacherId },
    data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100, ratingCount: stats._count._all },
  });
}

export async function upsertReview(studentId: string, teacherId: string, rating: number, comment: string, now = new Date()) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ReviewError("Puan 1 ile 5 arasında olmalı.");
  // Yorumlar herkese açık: iletişim bilgisi gizlenir (platform dışına yönlendirme olmasın)
  const text = maskContacts(comment.trim());
  if (text.length > 1500) throw new ReviewError("Yorum en fazla 1500 karakter olabilir.");

  const { eligible, bookingId, inquiryId, existing } = await reviewEligibility(studentId, teacherId, now);
  if (!eligible || (!bookingId && !inquiryId)) {
    throw new ReviewError("Değerlendirme yapabilmek için öğretmenin talebinizi kabul etmiş ve sizinle en az bir görüntülü ders yapmış olması gerekir.");
  }

  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.review.update({ where: { id: existing.id }, data: { rating, comment: text || null } });
    } else {
      await tx.review.create({ data: { bookingId, inquiryId: bookingId ? null : inquiryId, teacherId, studentId, rating, comment: text || null } });
      await notify(
        {
          userId: teacherId,
          type: "review.new",
          title: "Yeni bir değerlendirme aldınız",
          body: `${rating} yıldız${text ? `: “${text.slice(0, 140)}${text.length > 140 ? "…" : ""}”` : ""}`,
          link: "/ogretmen-paneli/yorumlar",
          email: false,
        },
        tx,
      );
    }
    await recomputeTeacherRating(tx, teacherId);
  });
}

export async function replyToReview(reviewId: string, teacherId: string, reply: string) {
  const text = maskContacts(reply.trim());
  if (text.length > 1000) throw new ReviewError("Cevap en fazla 1000 karakter olabilir.");
  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review || review.teacherId !== teacherId) throw new ReviewError("Yorum bulunamadı.");
  await db.review.update({
    where: { id: reviewId },
    data: { teacherReply: text || null, teacherRepliedAt: text ? new Date() : null },
  });
}

export async function setReviewStatus(reviewId: string, status: ReviewStatus, reason: string | null) {
  await db.$transaction(async (tx) => {
    const review = await tx.review.update({
      where: { id: reviewId },
      data: { status, hiddenReason: status === "HIDDEN" ? reason : null },
    });
    await recomputeTeacherRating(tx, review.teacherId);
  });
}

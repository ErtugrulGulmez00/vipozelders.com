import type { ReviewStatus } from "@/generated/prisma/client";
import { db, type DbTransaction } from "./db";
import { notify } from "./notifications";
import { loadSettings } from "./settings";

export class ReviewError extends Error {}

/** Öğrenci bu öğretmeni değerlendirebilir mi? En az bir dersi tamamlanmış ve süre dolmamış olmalı. */
export async function reviewEligibility(studentId: string, teacherId: string, now = new Date()) {
  const settings = await loadSettings();
  const since = new Date(now.getTime() - settings.reviewWindowDays * 24 * 3_600_000);
  const [lastCompleted, existing] = await Promise.all([
    db.booking.findFirst({
      where: { studentId, teacherId, status: "COMPLETED", isTest: false, completedAt: { gte: since } },
      orderBy: { completedAt: "desc" },
      select: { id: true },
    }),
    db.review.findUnique({ where: { teacherId_studentId: { teacherId, studentId } } }),
  ]);
  return { eligible: Boolean(lastCompleted), bookingId: lastCompleted?.id ?? null, existing };
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
  const text = comment.trim();
  if (text.length > 1500) throw new ReviewError("Yorum en fazla 1500 karakter olabilir.");

  const { eligible, bookingId, existing } = await reviewEligibility(studentId, teacherId, now);
  if (!eligible || !bookingId) {
    throw new ReviewError("Değerlendirme yapabilmek için bu öğretmenle en az bir dersinizin tamamlanmış olması gerekir.");
  }

  await db.$transaction(async (tx) => {
    if (existing) {
      await tx.review.update({ where: { id: existing.id }, data: { rating, comment: text || null } });
    } else {
      await tx.review.create({ data: { bookingId, teacherId, studentId, rating, comment: text || null } });
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
  const text = reply.trim();
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

import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { bookingSummaryJson } from "@/server/mobile/serialize";
import { profileChecklist } from "@/server/teachers";

/** Öğretmen ana ekranı: bekleyen talepler, yaklaşan dersler, puan, bakiye ve profil eksikleri. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "TEACHER");
  const now = new Date();
  const people = { teacher: { select: { slug: true, photoKey: true, user: { select: { firstName: true, lastName: true } } } }, student: { select: { firstName: true, lastName: true } } } as const;
  const [profile, pending, upcoming, balances, checklist] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { ratingAvg: true, ratingCount: true, completedLessons: true, status: true } }),
    db.booking.findMany({ where: { teacherId: user.id, status: "PENDING_APPROVAL" }, orderBy: { approvalDeadline: "asc" }, take: 10, include: people }),
    db.booking.findMany({ where: { teacherId: user.id, status: "CONFIRMED", endAt: { gt: now } }, orderBy: { startAt: "asc" }, take: 5, include: people }),
    teacherBalances(user.id),
    profileChecklist(user.id),
  ]);
  return json({
    profileStatus: profile.status,
    checklist: checklist.items,
    ratingAvg: profile.ratingAvg,
    ratingCount: profile.ratingCount,
    completedLessons: profile.completedLessons,
    balances,
    pendingRequests: pending.map((b) => bookingSummaryJson(b, "TEACHER")),
    upcoming: upcoming.map((b) => bookingSummaryJson(b, "TEACHER")),
  });
});

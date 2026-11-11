import "server-only";
import { cache } from "react";
import type { AppRole } from "@/lib/auth-constants";
import type { SideFacts } from "@/lib/sides";
import { db } from "./db";

/** Özel ders tarafında herhangi bir işlem (yalnızca varlığına bakılır). */
async function hasPrivateActivity(userId: string): Promise<boolean> {
  const where = { studentId: userId };
  const found = await Promise.all([
    db.booking.findFirst({ where, select: { id: true } }),
    db.lessonPackage.findFirst({ where, select: { id: true } }),
    db.groupEnrollment.findFirst({ where, select: { id: true } }),
    db.messageThread.findFirst({ where, select: { id: true } }),
    db.favorite.findFirst({ where, select: { teacherId: true } }),
  ]);
  return found.some(Boolean);
}

/** Kullanıcının hangi tarafları olduğu; istek başına bir kez hesaplanır. */
export const sideFacts = cache(async (userId: string, role: AppRole): Promise<SideFacts> => {
  if (role === "ADMIN") return { role, staff: false, portal: false, privateSide: true, privateActivity: false };
  const [memberships, links] = await Promise.all([
    db.centerMember.findMany({ where: { userId, isActive: true }, select: { center: { select: { kind: true } } } }),
    role === "STUDENT" ? db.centerGuardian.findMany({ where: { userId }, select: { isStudentAccount: true, student: { select: { center: { select: { kind: true } } } } } }) : Promise.resolve([]),
  ]);
  const privateActivity = role === "STUDENT" ? await hasPrivateActivity(userId) : role === "TEACHER";
  // Kurumun (ya da koçun) açtığı öğrenci hesabında özel ders tarafı, öğrenci orada bir işlem yapana kadar kapalı
  const studentAccount = links.some((l) => l.isStudentAccount);
  const privateSide = role === "TEACHER" || (role === "STUDENT" && (!studentAccount || privateActivity));
  // Pi Koç ayrı kapıdır: koç üyeliği ve koç öğrencisi bağlantısı kurum tarafına sayılmaz
  const isCoach = (kind: string) => kind === "COACH";
  return {
    role,
    staff: memberships.some((m) => !isCoach(m.center.kind)),
    portal: links.some((l) => !isCoach(l.student.center.kind)),
    kocStaff: memberships.some((m) => isCoach(m.center.kind)),
    kocStudent: links.some((l) => isCoach(l.student.center.kind)),
    privateSide,
    privateActivity,
  };
});

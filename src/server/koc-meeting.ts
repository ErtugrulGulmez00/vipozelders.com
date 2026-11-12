import "server-only";
import { db } from "./db";
import { notify } from "./notifications";
import { createRoomToken } from "./video";

// Pi Koç online görüşme: her öğrencinin sabit bir görüşme odası (koc-<öğrenci kimliği>) vardır. Koç ve öğrenci (ya da
// bağlı velisi) sitedeki sanal sınıfla görüşür; başka program gerekmez. Koç odaya girince öğrenciye bildirim gider.

/** Oda bir oturumda en fazla bu kadar açık kalır (anahtar süresi) */
export const MEETING_MINUTES = 120;

export function meetingRoomName(studentId: string) {
  return `koc-${studentId}`;
}

export type MeetingAccess =
  | { ok: false }
  | { ok: true; role: "teacher" | "student"; student: { id: string; firstName: string; lastName: string; centerName: string }; backHref: string; linkIds: string[] };

/** Koç (öğrencinin Pi Koç hesabındaki üye) ya da öğrencinin kendisi/velisi girebilir. */
export async function meetingAccess(userId: string, studentId: string): Promise<MeetingAccess> {
  const student = await db.centerStudent.findFirst({
    where: { id: studentId, status: "ACTIVE", center: { kind: "COACH", status: { not: "SUSPENDED" } } },
    select: { id: true, firstName: true, lastName: true, centerId: true, center: { select: { name: true } }, guardians: { where: { userId: { not: null } }, select: { id: true, userId: true } } },
  });
  if (!student) return { ok: false };
  const info = { id: student.id, firstName: student.firstName, lastName: student.lastName, centerName: student.center.name };
  const coach = await db.centerMember.findFirst({ where: { userId, centerId: student.centerId, isActive: true }, select: { id: true } });
  if (coach) return { ok: true, role: "teacher", student: info, backHref: `/koc/ogrenciler/${student.id}?sekme=gorusmeler`, linkIds: [] };
  const link = student.guardians.find((g) => g.userId === userId);
  if (link) return { ok: true, role: "student", student: info, backHref: `/kocum/${link.id}`, linkIds: [link.id] };
  return { ok: false };
}

/** Koç odaya girince öğrenciye ve velisine haber verir (30 dakikada bir kez). */
export async function announceMeeting(studentId: string, coachName: string) {
  const since = new Date(Date.now() - 30 * 60_000);
  const links = await db.centerGuardian.findMany({ where: { studentId, userId: { not: null } }, select: { userId: true } });
  for (const l of links) {
    const recent = await db.notification.findFirst({ where: { userId: l.userId!, type: "center.koc_meeting", createdAt: { gte: since } }, select: { id: true } });
    if (recent) continue;
    await notify({ userId: l.userId!, type: "center.koc_meeting", title: "Koçun görüşme odasında", body: `${coachName} online görüşme için seni bekliyor.`, link: `/gorusme/${studentId}` });
  }
}

/** Görüşme odası anahtarı (paket izin verdiği süre boyunca geçerli; ücretsiz pakette kısa). */
export async function meetingToken(studentId: string, role: "teacher" | "student", user: { id: string; firstName: string; lastName: string }, minutes = MEETING_MINUTES) {
  const closesAt = new Date(Date.now() + minutes * 60_000);
  const { token, serverUrl } = await createRoomToken({ room: meetingRoomName(studentId), role, closesAt }, user);
  return { token, serverUrl, endsAt: closesAt.getTime() };
}

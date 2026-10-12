import { dateStringToDbDate, toLocalDateString, addDaysToDateString } from "@/lib/dates";
import { hashToken, randomToken } from "../auth/password";
import { db } from "../db";
import { appUrl } from "../email";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";
import { studentNetTrend, studentWeakTopics } from "./exams";
import { studentBalance } from "./finance";

// Veli portalı: kurum, veliye davet bağlantısı gönderir; veli sitedeki hesabıyla bağlanır ve çocuğunu takip eder.

const INVITE_DAYS = 14;

export async function createGuardianInvite(ctx: CenterContext, guardianId: string, send: boolean) {
  const guardian = await db.centerGuardian.findFirst({ where: { id: guardianId, centerId: ctx.center.id }, include: { student: { select: { firstName: true, lastName: true } } } });
  if (!guardian) throw new CenterError("Veli bulunamadı.");
  if (guardian.userId) throw new CenterError("Bu veli hesabını zaten bağlamış.");
  const token = randomToken(24);
  await db.centerGuardian.update({ where: { id: guardianId }, data: { inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) } });
  const url = appUrl(`/kurum-davet/${token}`);
  if (send) {
    const name = `${guardian.student.firstName} ${guardian.student.lastName}`;
    await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: guardian.studentId,
      guardianIds: [guardian.id],
      force: true,
      kind: "invite",
      sms: `${name} için devamsızlık, deneme sonuçları ve ödemeleri veli portalından takip edebilirsiniz: ${url}`,
      email: {
        subject: "Veli portalı daveti",
        title: `${name} için veli portalı`,
        lines: [
          `${ctx.center.name}, ${name} için veli portalına sizi davet etti.`,
          "Portalda devamsızlık, etüt, deneme sonuçları, eksik konular, ödeme planı ve duyuruları görebilirsiniz.",
          `Bağlantı ${INVITE_DAYS} gün geçerlidir; ücretsiz veli hesabınızla giriş yapıp bağlantıyı onaylamanız yeterli.`,
        ],
        action: { label: "Daveti kabul et", url: `/kurum-davet/${token}` },
      },
    });
  }
  return url;
}

export async function findInvite(token: string) {
  const guardian = await db.centerGuardian.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { student: { select: { firstName: true, lastName: true, center: { select: { name: true, status: true } } } } },
  });
  if (!guardian || !guardian.inviteExpiresAt || guardian.inviteExpiresAt < new Date() || guardian.student.center.status === "SUSPENDED") return null;
  return guardian;
}

export async function acceptInvite(userId: string, token: string) {
  const guardian = await findInvite(token);
  if (!guardian) throw new CenterError("Davet bağlantısı geçersiz ya da süresi dolmuş. Kurumdan yeni bir davet isteyin.");
  await db.centerGuardian.update({ where: { id: guardian.id }, data: { userId, linkedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null } });
  return guardian;
}

export async function unlinkGuardian(userId: string, guardianId: string) {
  await db.centerGuardian.updateMany({ where: { id: guardianId, userId }, data: { userId: null, linkedAt: null } });
}

/** Velinin bağlı olduğu öğrenciler. */
export async function portalChildren(userId: string) {
  return db.centerGuardian.findMany({
    where: { userId, student: { center: { status: { not: "SUSPENDED" } } } },
    include: { student: { include: { center: { select: { name: true, slug: true, phone: true, logoKey: true } }, groups: { include: { group: { select: { name: true } } } } } } },
    orderBy: { linkedAt: "asc" },
  });
}

/** Veli portalındaki öğrenci sayfası verisi; yalnızca bağlantının sahibi görebilir. */
export async function portalChildDetail(userId: string, guardianId: string) {
  const guardian = await db.centerGuardian.findFirst({
    where: { id: guardianId, userId, student: { center: { status: { not: "SUSPENDED" } } } },
    include: { student: { include: { center: true, groups: { include: { group: { include: { slots: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } } } } } } } },
  });
  if (!guardian) return null;
  const { student } = guardian;
  const centerId = student.centerId;
  const today = toLocalDateString(new Date());
  const groupIds = student.groups.map((g) => g.groupId);
  const [attendance, etuds, results, installments, payments, announcements, notes, weakTopics, balance] = await Promise.all([
    db.centerAttendance.findMany({
      where: { studentId: student.id, session: { date: { gte: dateStringToDbDate(addDaysToDateString(today, -60)) } } },
      include: { session: { select: { date: true, startMinute: true, subject: true, group: { select: { name: true } } } } },
      orderBy: [{ session: { date: "desc" } }, { session: { startMinute: "desc" } }],
      take: 200,
    }),
    db.centerEtudStudent.findMany({
      where: { studentId: student.id, etud: { status: { not: "CANCELLED" }, date: { gte: dateStringToDbDate(addDaysToDateString(today, -60)) } } },
      include: { etud: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: { etud: { date: "desc" } },
      take: 50,
    }),
    db.centerExamResult.findMany({
      where: { studentId: student.id, exam: { isPublished: true } },
      include: { exam: { include: { sections: { orderBy: { order: "asc" } }, _count: { select: { results: true } } } }, sections: true },
      orderBy: { exam: { date: "desc" } },
      take: 30,
    }),
    db.centerInstallment.findMany({ where: { studentId: student.id, plan: { isCancelled: false } }, include: { plan: { select: { title: true } } }, orderBy: [{ dueDate: "asc" }, { order: "asc" }] }),
    db.centerPayment.findMany({ where: { studentId: student.id, cancelledAt: null }, orderBy: { paidAt: "desc" }, take: 20 }),
    db.centerAnnouncement.findMany({ where: { centerId, OR: [{ groupId: null }, { groupId: { in: groupIds } }] }, orderBy: { createdAt: "desc" }, take: 20, include: { group: { select: { name: true } } } }),
    db.centerNote.findMany({ where: { studentId: student.id, visibleToParent: true }, orderBy: { createdAt: "desc" }, take: 20, include: { author: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
    studentWeakTopics(centerId, student.id, { publishedOnly: true }),
    studentBalance(centerId, student.id, today),
  ]);
  const trend = results[0] ? await studentNetTrend(centerId, student.id, results[0].exam.kind, 10, true) : [];
  return { guardian, student, attendance, etuds, results, installments, payments, announcements, notes, weakTopics, balance, today, trend };
}

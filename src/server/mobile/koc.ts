import "server-only";
import { EXAM_PRESETS, type ExamKindName } from "@/lib/center/exams";
import { centerCan, type CenterRoleName } from "@/lib/center/permissions";
import { centerAccess } from "@/lib/center/subscription";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, isDateString, toLocalDateString } from "@/lib/dates";
import type { CenterContext, CenterSummary } from "../center/context";
import { studentCoachingHistory } from "../center/coaching";
import { CenterError } from "../center/errors";
import { weekStartOf } from "../center/resources";
import { db } from "../db";
import { KOC_EXAM_KINDS, kocOverview, questionStats, studentExams, studentGoals } from "../koc";
import { studyStats } from "../koc-extra";
import type { MobileAccount } from "./auth";
import { ApiError, notFound } from "./http";

// Pi Koç mobil uygulaması (pikoc-mobil) için veriler. Öğrenci/veli tarafı Pi Koç bağlantısıyla (CenterGuardian),
// koç tarafı Pi Koç hesabındaki üyelikle (CenterMember) çalışır. Tarihler "YYYY-AA-GG".

export const KOC_SUBJECTS = ["Matematik", "Geometri", "Türkçe", "Paragraf", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Edebiyat", "Fen Bilimleri", "İnkılap Tarihi", "Din Kültürü", "İngilizce"];

/** Sınav türleri ve bölümleri (deneme girişi formu için) */
export function examKindsJson() {
  return KOC_EXAM_KINDS.map((kind) => ({ kind, label: EXAM_PRESETS[kind].label, sections: EXAM_PRESETS[kind].sections.map((s) => ({ name: s.name, questionCount: s.questionCount })) }));
}

const linkWhere = (userId: string) => ({ userId, student: { status: "ACTIVE" as const, center: { kind: "COACH" as const, status: { not: "SUSPENDED" as const } } } });

/** Kullanıcının Pi Koç bağlantıları (öğrencinin kendi hesabı ya da velinin çocukları). */
export async function kocLinksJson(userId: string) {
  const links = await db.centerGuardian.findMany({
    where: linkWhere(userId),
    include: { student: { include: { center: { select: { name: true } } } } },
    orderBy: { linkedAt: "asc" },
  });
  return {
    items: links.map((l) => ({
      id: l.id,
      isStudent: l.isStudentAccount,
      student: { id: l.student.id, firstName: l.student.firstName, lastName: l.student.lastName, gradeName: l.student.gradeName, targetExam: l.student.targetExam },
      coachName: l.student.center.name,
    })),
  };
}

/** Bağlantının sahibi mi? Öğrenci kaydı ve kurum bilgisiyle döner. */
export async function kocLink(userId: string, linkId: string) {
  const link = await db.centerGuardian.findFirst({
    where: { id: linkId, ...linkWhere(userId) },
    include: { student: { include: { center: { select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, kind: true } } } } },
  });
  if (!link) throw notFound("Öğrenci bulunamadı.");
  return link;
}

function streakOf(dates: string[], today: string) {
  const logged = new Set(dates);
  let streak = 0;
  for (let d = logged.has(today) ? today : addDaysToDateString(today, -1); logged.has(d); d = addDaysToDateString(d, -1)) streak++;
  return streak;
}

function examJson(e: Awaited<ReturnType<typeof studentExams>>[number]) {
  return { id: e.examId, name: e.name, kind: e.kind, kindLabel: EXAM_PRESETS[e.kind as ExamKindName]?.label ?? e.kind, date: e.date, net: e.net, byStudent: e.byStudent, sections: e.sections.map((s) => ({ name: s.name, net: s.net })) };
}

/** Öğrencinin ortak verisi: bugün, istatistik, son kayıtlar, denemeler, hedefler (öğrenci ve koç ekranları için). */
async function studentBundle(studentId: string, centerId: string) {
  const today = toLocalDateString(new Date());
  const [stats, study, todayItems, streakRows, logs, sessions, exams, goals] = await Promise.all([
    questionStats(centerId, today, studentId),
    studyStats(studentId, today),
    db.centerStudyPlanItem.findMany({ where: { studentId, date: dateStringToDbDate(today) }, include: { resource: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.centerQuestionLog.findMany({ where: { studentId, date: { gte: dateStringToDbDate(addDaysToDateString(today, -60)) } }, select: { date: true }, distinct: ["date"] }),
    db.centerQuestionLog.findMany({ where: { studentId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 }),
    db.centerStudySession.findMany({ where: { studentId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 20 }),
    studentExams(centerId, studentId),
    studentGoals(centerId, studentId),
  ]);
  return {
    today,
    todayItems: todayItems.map((i) => ({ id: i.id, subject: i.subject, topic: i.topic, resource: i.resource?.name ?? null, targetQuestions: i.targetQuestions, note: i.note, done: Boolean(i.doneAt) })),
    stats: {
      weekSolved: stats.thisWeek,
      lastWeekSolved: stats.lastWeek,
      weekStudyMinutes: study.thisWeek,
      lastWeekStudyMinutes: study.lastWeek,
      streak: streakOf(streakRows.map((r) => dbDateToString(r.date)), today),
      questionDays: stats.days,
      studyDays: study.days,
      subjects: stats.subjects.map((s) => ({ subject: s.subject, solved: s.solved, accuracy: s.accuracy })),
    },
    questionLogs: logs.map((l) => ({ id: l.id, date: dbDateToString(l.date), subject: l.subject, solved: l.solved, correct: l.correct, wrong: l.wrong, byStudent: l.byStudent })),
    studySessions: sessions.map((s) => ({ id: s.id, date: dbDateToString(s.date), subject: s.subject, minutes: s.minutes, byStudent: s.byStudent })),
    exams: exams.map(examJson),
    goals: goals.map((g) => ({ kind: g.kind, kindLabel: g.kindLabel, label: g.label, targetNet: g.targetNet, gap: g.gap, current: g.current?.net ?? null, sections: g.sections })),
  };
}

/** Öğrenci / veli ana ekranı. */
export async function kocStudentHomeJson(userId: string, linkId: string) {
  const link = await kocLink(userId, linkId);
  const s = link.student;
  const writable = centerAccess(s.center).writable;
  return {
    id: link.id,
    isStudent: link.isStudentAccount,
    // Öğrenci kendi hesabıyla kayıt girer; veli yalnızca görür. Koçun aboneliği bittiyse yeni kayıt girilmez.
    canWrite: link.isStudentAccount && writable,
    student: { id: s.id, firstName: s.firstName, lastName: s.lastName, gradeName: s.gradeName, targetExam: s.targetExam },
    coachName: s.center.name,
    meeting: s.coachWeekday ? { weekday: s.coachWeekday, minute: s.coachMinute } : null,
    subjects: KOC_SUBJECTS,
    ...(await studentBundle(s.id, s.centerId)),
  };
}

/** Haftalık program ve veliye açık koç notları. */
export async function kocProgramJson(studentId: string, centerId: string, week: string | null, parentOnly: boolean) {
  const today = toLocalDateString(new Date());
  const weekStart = weekStartOf(week && isDateString(week) ? week : today);
  const [items, coaching] = await Promise.all([
    db.centerStudyPlanItem.findMany({
      where: { centerId, studentId, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(addDaysToDateString(weekStart, 7)) } },
      include: { resource: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    studentCoachingHistory(centerId, studentId, { parentOnly, take: 10 }),
  ]);
  return {
    weekStart,
    weekEnd: addDaysToDateString(weekStart, 6),
    today,
    items: items.map((i) => ({ id: i.id, date: dbDateToString(i.date), subject: i.subject, topic: i.topic, resource: i.resource?.name ?? null, targetQuestions: i.targetQuestions, note: i.note, done: Boolean(i.doneAt) })),
    notes: coaching.sessions.map((x) => ({ id: x.id, date: x.dateString, held: x.held, notes: x.notes, priorityTopics: x.priorityTopics, nextGoal: x.nextGoal })),
  };
}

// ---------------------------------------------------------------------------
// Koç tarafı
// ---------------------------------------------------------------------------

/** Kullanıcının Pi Koç hesabı (koç / Pi Koç ekibi). Rolü ne olursa olsun (özel ders öğretmeni de koç olabilir). */
export async function mobileCoachContext(user: MobileAccount): Promise<CenterContext> {
  const member = await db.centerMember.findFirst({
    where: { userId: user.id, isActive: true, center: { kind: "COACH", status: { not: "SUSPENDED" } } },
    include: { center: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) throw new ApiError(403, "NOT_COACH", "Bu hesapta Pi Koç paneli yok.");
  const center = member.center as unknown as CenterSummary;
  const role = member.role as CenterRoleName;
  return {
    user: { id: user.id, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email, username: user.username, phone: user.phone, mustChangePassword: user.mustChangePassword, emailVerified: user.emailVerified },
    member: { id: member.id, role, title: member.title, branch: member.branch },
    center,
    access: centerAccess(center),
    memberships: [{ centerId: center.id, centerName: center.name, role }],
    can: (permission) => centerCan(role, permission),
  };
}

export async function coachHomeJson(ctx: CenterContext) {
  const today = toLocalDateString(new Date());
  const { cards } = await kocOverview(ctx, today);
  const access = ctx.access;
  return {
    center: { name: ctx.center.name, status: ctx.center.status, trialEndsAt: ctx.center.trialEndsAt?.toISOString() ?? null, paidUntil: ctx.center.paidUntil?.toISOString() ?? null, studentLimit: ctx.center.studentLimit, writable: access.writable },
    today,
    students: cards.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      gradeName: c.gradeName,
      targetExam: c.targetExam,
      meeting: c.meeting,
      lastSessionDate: c.lastSessionDate,
      solvedThisWeek: c.solvedThisWeek,
      planDone: c.planDone,
      planTotal: c.planTotal,
      netKind: c.netKind,
      lastNet: c.nets.length ? c.nets[c.nets.length - 1] : null,
      netChange: c.netChange,
      alerts: c.alerts,
    })),
  };
}

export async function coachStudentJson(ctx: CenterContext, studentId: string) {
  const s = await db.centerStudent.findFirst({ where: { id: studentId, centerId: ctx.center.id }, include: { guardians: { select: { isStudentAccount: true, userId: true } } } });
  if (!s) throw notFound("Öğrenci bulunamadı.");
  return {
    student: { id: s.id, firstName: s.firstName, lastName: s.lastName, gradeName: s.gradeName, targetExam: s.targetExam, phone: s.phone, active: s.status === "ACTIVE" },
    hasStudentAccount: s.guardians.some((g) => g.isStudentAccount && g.userId),
    meeting: s.coachWeekday ? { weekday: s.coachWeekday, minute: s.coachMinute } : null,
    subjects: KOC_SUBJECTS,
    ...(await studentBundle(s.id, ctx.center.id)),
  };
}

/** Pi Koç iş kuralı hatalarını (CenterError) mobil API biçimine çevirir: 422 + alan hataları. */
export async function ruleErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CenterError) throw new ApiError(422, "RULE_VIOLATION", error.message, error.fieldErrors);
    throw error;
  }
}

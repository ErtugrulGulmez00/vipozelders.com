import { addDaysToDateString, dateStringToDbDate, dbDateToString, isoWeekday } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { weekStartOf } from "./resources";

// Koçluk / mentorluk: her öğrencinin bir koçu ve haftalık görüşme günü-saati vardır. Koç her görüşmeyi not, öncelikli
// konular ve sonraki hedefle kaydeder; kurum yöneticisi (koordinatör) tüm koçların haftalık durumunu izler.

const isManager = (ctx: CenterContext) => ctx.member.role === "OWNER" || ctx.member.role === "MANAGER";

/** Öğretmen yalnızca kendi öğrencilerini, yönetici herkesi görür. */
export function coachScope(ctx: CenterContext): { coachId?: string } {
  return isManager(ctx) ? {} : { coachId: ctx.member.id };
}

export type CoachAssignment = { studentId: string; coachId: string | null; weekday: number | null; minute: number | null };

/** Koç ve görüşme saatlerini toplu kaydeder (yalnızca kurum sahibi/müdür). */
export async function saveCoachAssignments(ctx: CenterContext, rows: CoachAssignment[]) {
  if (!isManager(ctx)) throw new CenterError("Koç atamasını kurum sahibi ya da müdür yapabilir.");
  const members = new Set((await db.centerMember.findMany({ where: { centerId: ctx.center.id, isActive: true }, select: { id: true } })).map((m) => m.id));
  const students = new Set((await db.centerStudent.findMany({ where: { centerId: ctx.center.id, id: { in: rows.map((r) => r.studentId) } }, select: { id: true } })).map((s) => s.id));
  const valid = rows.filter((r) => students.has(r.studentId) && (!r.coachId || members.has(r.coachId)));
  await db.$transaction(
    valid.map((r) =>
      db.centerStudent.update({
        where: { id: r.studentId },
        data: {
          coachId: r.coachId,
          coachWeekday: r.coachId && r.weekday && r.weekday >= 1 && r.weekday <= 7 ? r.weekday : null,
          coachMinute: r.coachId && r.minute !== null && r.minute >= 0 && r.minute < 1440 ? r.minute : null,
        },
      }),
    ),
  );
  return valid.length;
}

export type CoachingInput = { studentId: string; date: string; held: boolean; notes: string; priorityTopics: string[]; nextGoal: string | null; visibleToParent: boolean };

export async function addCoachingSession(ctx: CenterContext, input: CoachingInput) {
  const student = await db.centerStudent.findFirst({ where: { id: input.studentId, centerId: ctx.center.id }, select: { id: true, coachId: true } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  if (!isManager(ctx) && student.coachId !== ctx.member.id) throw new CenterError("Yalnızca koçu olduğunuz öğrenciler için görüşme kaydedebilirsiniz.");
  if (!input.notes.trim() && input.held) throw new CenterError("Görüşme notunu yazın.", { notes: "Not gerekli." });
  return db.centerCoachingSession.create({
    data: {
      centerId: ctx.center.id,
      studentId: student.id,
      coachId: ctx.member.id,
      date: dateStringToDbDate(input.date),
      held: input.held,
      notes: input.notes.trim() || "Görüşme yapılamadı.",
      priorityTopics: input.priorityTopics.map((t) => t.trim()).filter(Boolean).slice(0, 10),
      nextGoal: input.nextGoal,
      visibleToParent: input.visibleToParent,
    },
  });
}

export async function deleteCoachingSession(ctx: CenterContext, sessionId: string) {
  const session = await db.centerCoachingSession.findFirst({ where: { id: sessionId, centerId: ctx.center.id } });
  if (!session) throw new CenterError("Görüşme bulunamadı.");
  if (!isManager(ctx) && session.coachId !== ctx.member.id) throw new CenterError("Bu görüşmeyi başka bir koç kaydetti.");
  await db.centerCoachingSession.delete({ where: { id: sessionId } });
}

/** Koçluk ana ekranı: bu haftanın görüşme listesi (öğrencinin haftalık günü), yapılan/bekleyen durumu ve koç özeti. */
export async function coachingOverview(ctx: CenterContext, today: string) {
  const weekStart = weekStartOf(today);
  const weekEnd = addDaysToDateString(weekStart, 7);
  const scope = coachScope(ctx);
  const [students, sessions, coaches] = await Promise.all([
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE", coachId: scope.coachId ?? { not: null } },
      select: { id: true, firstName: true, lastName: true, coachId: true, coachWeekday: true, coachMinute: true, groups: { select: { group: { select: { name: true } } } } },
      orderBy: [{ coachWeekday: "asc" }, { coachMinute: "asc" }],
    }),
    db.centerCoachingSession.findMany({
      where: { centerId: ctx.center.id, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(weekEnd) }, ...(scope.coachId ? { student: { coachId: scope.coachId } } : {}) },
      select: { studentId: true, held: true, date: true },
    }),
    db.centerMember.findMany({ where: { centerId: ctx.center.id, isActive: true, coachees: { some: { status: "ACTIVE" } } }, include: { user: { select: { firstName: true, lastName: true } }, _count: { select: { coachees: { where: { status: "ACTIVE" } } } } } }),
  ]);
  const met = new Map(sessions.map((s) => [s.studentId, s]));
  const todayWeekday = isoWeekday(today);
  const rows = students.map((s) => {
    const session = met.get(s.id);
    const due = s.coachWeekday !== null && s.coachWeekday < todayWeekday;
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      groups: s.groups.map((g) => g.group.name).join(", "),
      coachId: s.coachId,
      weekday: s.coachWeekday,
      minute: s.coachMinute,
      date: s.coachWeekday ? addDaysToDateString(weekStart, s.coachWeekday - 1) : null,
      status: session ? (session.held ? "DONE" : "MISSED") : due ? "OVERDUE" : s.coachWeekday === todayWeekday ? "TODAY" : "UPCOMING",
    } as const;
  });
  const coachStats = coaches.map((c) => {
    const mine = rows.filter((r) => r.coachId === c.id);
    return { id: c.id, name: `${c.user.firstName} ${c.user.lastName}`, students: c._count.coachees, done: mine.filter((r) => r.status === "DONE").length, overdue: mine.filter((r) => r.status === "OVERDUE").length };
  });
  return { weekStart, rows, coachStats, unassigned: isManager(ctx) ? await db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE", coachId: null } }) : 0 };
}

/** Öğrencinin görüşme geçmişi ve en sık geçen öncelikli konular. */
export async function studentCoachingHistory(centerId: string, studentId: string, options: { parentOnly?: boolean; take?: number } = {}) {
  const sessions = await db.centerCoachingSession.findMany({
    where: { centerId, studentId, ...(options.parentOnly ? { visibleToParent: true } : {}) },
    include: { coach: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { date: "desc" },
    take: options.take ?? 30,
  });
  const counts = new Map<string, number>();
  for (const s of sessions) for (const t of s.priorityTopics) counts.set(t, (counts.get(t) ?? 0) + 1);
  const topTopics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
  return { sessions: sessions.map((s) => ({ ...s, dateString: dbDateToString(s.date), coachName: s.coach ? `${s.coach.user.firstName} ${s.coach.user.lastName}` : null })), topTopics };
}

import "server-only";
import { computeNet, EXAM_PRESETS, round2, type ExamKindName } from "@/lib/center/exams";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, isoWeekday } from "@/lib/dates";
import type { CenterContext } from "./center/context";
import { CenterError } from "./center/errors";
import { upsertResult } from "./center/exams";
import { weekStartOf } from "./center/resources";
import { db } from "./db";

// Pi Koç: bireysel koçun öğrenci takibi. Veri kurum tablolarında tutulur (Center türü COACH); ekranlar /koc altındadır.

export const KOC_EXAM_KINDS: ExamKindName[] = ["LGS", "TYT", "AYT_SAY", "AYT_EA", "AYT_SOZ", "YDT"];

/** Koçun öğrencisi mi? (yalnızca kendi hesabındaki öğrenci) */
export async function kocStudentOrThrow(ctx: CenterContext, studentId: string) {
  const student = await db.centerStudent.findFirst({ where: { id: studentId, centerId: ctx.center.id } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  return student;
}

// ---------------------------------------------------------------------------
// Günlük soru takibi
// ---------------------------------------------------------------------------

export type QuestionLogInput = { date: string; subject: string; solved: number; correct: number; wrong: number };

export async function addQuestionLog(ctx: CenterContext, studentId: string, input: QuestionLogInput) {
  await kocStudentOrThrow(ctx, studentId);
  if (input.solved < 1) throw new CenterError("Çözülen soru sayısını yazın.", { solved: "En az 1." });
  if (input.correct + input.wrong > input.solved) throw new CenterError("Doğru + yanlış, çözülen sorudan fazla olamaz.", { correct: "Toplamı kontrol edin." });
  return db.centerQuestionLog.create({ data: { centerId: ctx.center.id, studentId, ...input, date: dateStringToDbDate(input.date) } });
}

export async function deleteQuestionLog(ctx: CenterContext, logId: string) {
  const row = await db.centerQuestionLog.findFirst({ where: { id: logId, centerId: ctx.center.id }, select: { id: true } });
  if (!row) throw new CenterError("Kayıt bulunamadı.");
  await db.centerQuestionLog.delete({ where: { id: logId } });
}

/** Son 8 haftanın haftalık soru toplamı ve son 30 günün ders dağılımı. */
export async function questionStats(centerId: string, today: string, studentId?: string) {
  const thisWeek = weekStartOf(today);
  const from = addDaysToDateString(thisWeek, -7 * 7);
  const logs = await db.centerQuestionLog.findMany({
    where: { centerId, ...(studentId ? { studentId } : {}), date: { gte: dateStringToDbDate(from) } },
    select: { date: true, subject: true, solved: true, correct: true, wrong: true, studentId: true },
  });
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDaysToDateString(from, i * 7);
    const end = addDaysToDateString(start, 7);
    const rows = logs.filter((l) => {
      const d = dbDateToString(l.date);
      return d >= start && d < end;
    });
    return { start, solved: rows.reduce((t, r) => t + r.solved, 0) };
  });
  const last30 = addDaysToDateString(today, -29);
  const bySubject = new Map<string, { solved: number; correct: number; wrong: number }>();
  for (const l of logs) {
    if (dbDateToString(l.date) < last30) continue;
    const s = bySubject.get(l.subject) ?? { solved: 0, correct: 0, wrong: 0 };
    s.solved += l.solved;
    s.correct += l.correct;
    s.wrong += l.wrong;
    bySubject.set(l.subject, s);
  }
  const subjects = [...bySubject.entries()]
    .map(([subject, s]) => ({ subject, ...s, accuracy: s.correct + s.wrong ? s.correct / (s.correct + s.wrong) : null }))
    .sort((a, b) => b.solved - a.solved);
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = addDaysToDateString(today, i - 13);
    return { date, solved: logs.filter((l) => dbDateToString(l.date) === date).reduce((t, r) => t + r.solved, 0) };
  });
  return { weeks, subjects, days, thisWeek: weeks[weeks.length - 1].solved, lastWeek: weeks[weeks.length - 2].solved };
}

// ---------------------------------------------------------------------------
// Deneme sonucu (tek öğrenci): koç yayınevinin sonuç kâğıdından ders ders doğru/yanlış girer
// ---------------------------------------------------------------------------

export type KocExamInput = { kind: ExamKindName; name: string; date: string; sections: { correct: number; wrong: number }[] };

export async function addStudentExam(ctx: CenterContext, studentId: string, input: KocExamInput) {
  await kocStudentOrThrow(ctx, studentId);
  const preset = EXAM_PRESETS[input.kind];
  if (!KOC_EXAM_KINDS.includes(input.kind)) throw new CenterError("Sınav türünü seçin.");
  preset.sections.forEach((section, i) => {
    const s = input.sections[i] ?? { correct: 0, wrong: 0 };
    if (s.correct < 0 || s.wrong < 0 || s.correct + s.wrong > section.questionCount) {
      throw new CenterError(`${section.name}: doğru + yanlış en fazla ${section.questionCount} olabilir.`, { [`c${i}`]: "Kontrol edin." });
    }
  });
  if (input.sections.every((s) => !s.correct && !s.wrong)) throw new CenterError("En az bir dersin doğru ve yanlışını yazın.");
  const exam = await db.centerExam.create({
    data: {
      centerId: ctx.center.id,
      name: input.name,
      kind: input.kind,
      date: dateStringToDbDate(input.date),
      wrongPenalty: preset.wrongPenalty,
      sections: { create: preset.sections.map((s, order) => ({ name: s.name, questionCount: s.questionCount, subjectSlug: s.subjectSlug, order, topics: [] })) },
    },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  const scored = exam.sections.map((section, i) => {
    const s = input.sections[i] ?? { correct: 0, wrong: 0 };
    return { sectionId: section.id, correct: s.correct, wrong: s.wrong, blank: section.questionCount - s.correct - s.wrong, net: computeNet(s.correct, s.wrong, exam.wrongPenalty), answers: null };
  });
  await upsertResult(exam.id, studentId, scored, null);
  return exam;
}

/** Yalnızca bu öğrenciye ait (tek sonuçlu) denemeyi siler. */
export async function deleteStudentExam(ctx: CenterContext, examId: string) {
  const exam = await db.centerExam.findFirst({ where: { id: examId, centerId: ctx.center.id }, select: { id: true } });
  if (!exam) throw new CenterError("Deneme bulunamadı.");
  await db.centerExam.delete({ where: { id: examId } });
}

/** Öğrencinin denemeleri (yeniden eskiye), ders netleriyle. */
export async function studentExams(centerId: string, studentId: string) {
  const results = await db.centerExamResult.findMany({
    where: { studentId, exam: { centerId } },
    include: { exam: { select: { id: true, name: true, kind: true, date: true } }, sections: { include: { section: { select: { name: true, questionCount: true, order: true } } } } },
    orderBy: { exam: { date: "desc" } },
  });
  return results.map((r) => ({
    examId: r.exam.id,
    name: r.exam.name,
    kind: r.exam.kind as ExamKindName,
    date: dbDateToString(r.exam.date),
    net: r.net,
    correct: r.correct,
    wrong: r.wrong,
    blank: r.blank,
    sections: r.sections.sort((a, b) => a.section.order - b.section.order).map((s) => ({ name: s.section.name, questionCount: s.section.questionCount, net: s.net, correct: s.correct, wrong: s.wrong })),
  }));
}

// ---------------------------------------------------------------------------
// Genel bakış
// ---------------------------------------------------------------------------

export type KocStudentCard = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  gradeName: string | null;
  targetExam: string | null;
  meeting: { weekday: number; minute: number | null } | null;
  lastSessionDate: string | null;
  metThisWeek: boolean;
  netKind: ExamKindName | null;
  nets: number[];
  netChange: number | null;
  solvedThisWeek: number;
  planDone: number;
  planTotal: number;
  alerts: string[];
};

export async function kocOverview(ctx: CenterContext, today: string) {
  const centerId = ctx.center.id;
  const weekStart = weekStartOf(today);
  const weekEnd = addDaysToDateString(weekStart, 7);
  const [students, sessions, plan, logs, results] = await Promise.all([
    db.centerStudent.findMany({ where: { centerId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    db.centerCoachingSession.findMany({ where: { centerId }, select: { studentId: true, date: true, held: true }, orderBy: { date: "desc" } }),
    db.centerStudyPlanItem.findMany({ where: { centerId, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(weekEnd) } }, select: { studentId: true, doneAt: true } }),
    db.centerQuestionLog.findMany({ where: { centerId, date: { gte: dateStringToDbDate(addDaysToDateString(today, -13)) } }, select: { studentId: true, date: true, solved: true } }),
    db.centerExamResult.findMany({ where: { exam: { centerId } }, select: { studentId: true, net: true, exam: { select: { kind: true, date: true } } }, orderBy: { exam: { date: "asc" } } }),
  ]);
  const todayWeekday = isoWeekday(today);
  const cards: KocStudentCard[] = students.map((s) => {
    const mine = sessions.filter((x) => x.studentId === s.id);
    const last = mine.find((x) => x.held);
    const metThisWeek = mine.some((x) => dbDateToString(x.date) >= weekStart && dbDateToString(x.date) < weekEnd);
    const own = results.filter((r) => r.studentId === s.id);
    const netKind = (own[own.length - 1]?.exam.kind as ExamKindName | undefined) ?? null;
    const nets = own.filter((r) => r.exam.kind === netKind).map((r) => r.net).slice(-8);
    const netChange = nets.length >= 2 ? round2(nets[nets.length - 1] - nets[nets.length - 2]) : null;
    const items = plan.filter((p) => p.studentId === s.id);
    const myLogs = logs.filter((l) => l.studentId === s.id);
    const solvedThisWeek = myLogs.filter((l) => dbDateToString(l.date) >= weekStart).reduce((t, l) => t + l.solved, 0);
    const lastSessionDate = last ? dbDateToString(last.date) : null;
    const alerts: string[] = [];
    if (!lastSessionDate) alerts.push("Henüz görüşme yok");
    else if (lastSessionDate < addDaysToDateString(today, -14)) alerts.push("2 haftadır görüşme yok");
    if (netChange !== null && netChange <= -3) alerts.push(`Son denemede ${Math.abs(netChange).toLocaleString("tr-TR")} net düştü`);
    if (!myLogs.length) alerts.push("2 haftadır soru girilmedi");
    if (todayWeekday >= 4 && items.length && items.filter((i) => i.doneAt).length / items.length < 0.4) alerts.push("Haftalık program geride");
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      firstName: s.firstName,
      lastName: s.lastName,
      gradeName: s.gradeName,
      targetExam: s.targetExam,
      meeting: s.coachWeekday ? { weekday: s.coachWeekday, minute: s.coachMinute } : null,
      lastSessionDate,
      metThisWeek,
      netKind,
      nets,
      netChange,
      solvedThisWeek,
      planDone: items.filter((i) => i.doneAt).length,
      planTotal: items.length,
      alerts,
    };
  });
  return { cards, weekStart, todayWeekday };
}

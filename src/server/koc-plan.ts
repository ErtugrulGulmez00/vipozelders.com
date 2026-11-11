import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { BUILTIN_TEMPLATES, cleanTemplateItems, type TemplateItem } from "@/lib/koc-templates";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, isoWeekday, minutesToTime, toLocalDateString, toLocalMinutes } from "@/lib/dates";
import type { CenterContext } from "./center/context";
import { CenterError } from "./center/errors";
import { studentWeakTopics } from "./center/exams";
import { getResourceOrThrow, weekStartOf } from "./center/resources";
import { db } from "./db";
import { kocStudentOrThrow } from "./koc";
import { notify } from "./notifications";

// Pi Koç: kitap bitiş tahmini, konu eksik haritası, hazır program şablonları ve hatırlatmalar.

// ---------------------------------------------------------------------------
// Kitap bitiş tahmini: son 4 haftada biten konu hızına göre kalan konuların bitiş günü
// ---------------------------------------------------------------------------

export function resourceForecast(topics: string[], progress: { topic: string; completedAt: Date | null }[], today: string) {
  const allowed = new Set(topics);
  const done = progress.filter((p) => p.completedAt && allowed.has(p.topic));
  const remaining = Math.max(0, topics.length - done.length);
  if (!remaining) return { remaining, finishDate: null as string | null, perWeek: null as number | null, finished: true };
  const since = addDaysToDateString(today, -28);
  const recent = done.filter((p) => toLocalDateString(p.completedAt!) > since).length;
  if (!recent) return { remaining, finishDate: null, perWeek: 0, finished: false };
  const perDay = recent / 28;
  return { remaining, finishDate: addDaysToDateString(today, Math.ceil(remaining / perDay)), perWeek: Math.round(perDay * 7 * 10) / 10, finished: false };
}

// ---------------------------------------------------------------------------
// Konu eksik haritası: kaynak ilerlemesinden konu başarısı + deneme konu analizi + görüşmedeki öncelikli konular
// ---------------------------------------------------------------------------

export type TopicCell = { topic: string; resourceId: string | null; solved: number; accuracy: number | null; done: boolean; level: "weak" | "mid" | "good" | "none"; flagged: boolean };

const levelOf = (accuracy: number | null): TopicCell["level"] => (accuracy === null ? "none" : accuracy < 0.5 ? "weak" : accuracy < 0.75 ? "mid" : "good");

export async function topicMap(centerId: string, studentId: string) {
  const [resources, weakExam, sessions] = await Promise.all([
    db.centerStudentResource.findMany({ where: { studentId }, include: { resource: { select: { id: true, name: true, subject: true, topics: true } }, progress: true }, orderBy: { assignedAt: "asc" } }),
    studentWeakTopics(centerId, studentId),
    db.centerCoachingSession.findMany({ where: { centerId, studentId }, select: { priorityTopics: true }, orderBy: { date: "desc" }, take: 8 }),
  ]);
  const flagged = new Set(sessions.flatMap((s) => s.priorityTopics.map((t) => t.toLocaleLowerCase("tr-TR"))));
  const groups = resources.map((r) => {
    const byTopic = new Map(r.progress.map((p) => [p.topic, p]));
    const cells: TopicCell[] = r.resource.topics.map((topic) => {
      const p = byTopic.get(topic);
      const answered = (p?.correct ?? 0) + (p?.wrong ?? 0);
      const accuracy = answered ? p!.correct / answered : null;
      return { topic, resourceId: r.resource.id, solved: p?.solved ?? 0, accuracy, done: Boolean(p?.completedAt), level: levelOf(accuracy), flagged: flagged.has(topic.toLocaleLowerCase("tr-TR")) };
    });
    return { key: r.id, title: r.resource.name, subject: r.resource.subject, cells };
  });
  // Denemedeki zayıf konular (cevap anahtarına konu girilmişse)
  const examCells = weakExam.slice(0, 12).map((w) => ({ topic: w.topic, subject: w.sectionName, accuracy: w.rate }));
  const weakCount = groups.reduce((t, g) => t + g.cells.filter((c) => c.level === "weak").length, 0) + examCells.length;
  return { groups, examCells, weakCount };
}

/** Konuyu öğrencinin programına ekler (zayıf konu haritasından tek tıkla). */
export async function addTopicToPlan(ctx: CenterContext, studentId: string, input: { subject: string; topic: string; resourceId: string | null; date: string; targetQuestions: number | null }) {
  await kocStudentOrThrow(ctx, studentId);
  if (input.resourceId) await getResourceOrThrow(ctx, input.resourceId);
  const exists = await db.centerStudyPlanItem.findFirst({ where: { studentId, date: dateStringToDbDate(input.date), subject: input.subject, topic: input.topic } });
  if (exists) throw new CenterError("Bu konu o gün zaten programda.");
  return db.centerStudyPlanItem.create({
    data: { centerId: ctx.center.id, studentId, date: dateStringToDbDate(input.date), subject: input.subject, topic: input.topic, resourceId: input.resourceId, targetQuestions: input.targetQuestions, note: "Eksik konu tekrarı" },
  });
}

// ---------------------------------------------------------------------------
// Program şablonları
// ---------------------------------------------------------------------------

export async function planTemplates(centerId: string) {
  const own = await db.centerPlanTemplate.findMany({ where: { centerId }, orderBy: { createdAt: "desc" } });
  return [
    ...own.map((t) => ({ id: t.id, name: t.name, description: `${cleanTemplateItems(t.items).length} görev · sizin şablonunuz`, items: cleanTemplateItems(t.items), own: true })),
    ...BUILTIN_TEMPLATES.map((t) => ({ ...t, own: false })),
  ];
}

/** Öğrencinin bir haftasını şablon olarak kaydeder. */
export async function saveWeekAsTemplate(ctx: CenterContext, studentId: string, weekStart: string, name: string) {
  await kocStudentOrThrow(ctx, studentId);
  const items = await db.centerStudyPlanItem.findMany({ where: { studentId, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(addDaysToDateString(weekStart, 7)) } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  if (!items.length) throw new CenterError("Bu haftada kaydedilecek program yok.");
  const rows: TemplateItem[] = items.map((i) => ({ weekday: isoWeekday(dbDateToString(i.date)), subject: i.subject, topic: i.topic, targetQuestions: i.targetQuestions, note: i.note }));
  return db.centerPlanTemplate.create({ data: { centerId: ctx.center.id, name, items: rows as unknown as Prisma.InputJsonValue } });
}

export async function deleteTemplate(ctx: CenterContext, templateId: string) {
  const found = await db.centerPlanTemplate.findFirst({ where: { id: templateId, centerId: ctx.center.id }, select: { id: true } });
  if (!found) throw new CenterError("Şablon bulunamadı.");
  await db.centerPlanTemplate.delete({ where: { id: templateId } });
}

/** Şablonu öğrencinin haftasına uygular; aynı gün aynı ders/konu varsa tekrar eklenmez. */
export async function applyTemplate(ctx: CenterContext, studentId: string, templateId: string, weekStart: string) {
  await kocStudentOrThrow(ctx, studentId);
  const template = (await planTemplates(ctx.center.id)).find((t) => t.id === templateId);
  if (!template) throw new CenterError("Şablon bulunamadı.");
  const start = weekStartOf(weekStart);
  const existing = await db.centerStudyPlanItem.findMany({ where: { studentId, date: { gte: dateStringToDbDate(start), lt: dateStringToDbDate(addDaysToDateString(start, 7)) } }, select: { date: true, subject: true, topic: true } });
  const key = (date: string, subject: string, topic: string | null) => `${date}|${subject}|${topic ?? ""}`;
  const taken = new Set(existing.map((e) => key(dbDateToString(e.date), e.subject, e.topic)));
  const rows = template.items
    .map((i) => ({ ...i, date: addDaysToDateString(start, i.weekday - 1) }))
    .filter((i) => !taken.has(key(i.date, i.subject, i.topic)));
  if (!rows.length) return 0;
  await db.centerStudyPlanItem.createMany({
    data: rows.map((i) => ({ centerId: ctx.center.id, studentId, date: dateStringToDbDate(i.date), subject: i.subject, topic: i.topic, targetQuestions: i.targetQuestions, note: i.note })),
  });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Hatırlatmalar (zamanlayıcı, dakikada bir çağrılır; gün/hafta başına bir kez gider)
// ---------------------------------------------------------------------------

/** Koça sabah: bugünkü görüşmeleri (08:00-11:00 arası, günde bir kez). */
export async function sendCoachDigests(now = new Date()): Promise<number> {
  const minutes = toLocalMinutes(now);
  if (minutes < 8 * 60 || minutes > 11 * 60) return 0;
  const today = toLocalDateString(now);
  const weekday = isoWeekday(today);
  const centers = await db.center.findMany({
    where: { kind: "COACH", status: { not: "SUSPENDED" }, OR: [{ coachDigestOn: null }, { coachDigestOn: { lt: dateStringToDbDate(today) } }], students: { some: { status: "ACTIVE", coachWeekday: weekday } } },
    select: { id: true, members: { where: { isActive: true, role: "OWNER" }, select: { userId: true } }, students: { where: { status: "ACTIVE", coachWeekday: weekday }, select: { firstName: true, lastName: true, coachMinute: true }, orderBy: { coachMinute: "asc" } } },
    take: 200,
  });
  let sent = 0;
  for (const c of centers) {
    // Önce işaretle: hata olsa da aynı gün ikinci kez gitmez
    await db.center.update({ where: { id: c.id }, data: { coachDigestOn: dateStringToDbDate(today) } });
    const list = c.students.map((s) => `${s.coachMinute !== null ? `${minutesToTime(s.coachMinute)} ` : ""}${s.firstName} ${s.lastName}`).join(", ");
    for (const m of c.members) {
      await notify({ userId: m.userId, type: "center.koc_digest", title: `Bugün ${c.students.length} görüşmeniz var`, body: list, link: "/koc/hafta" });
      sent++;
    }
  }
  return sent;
}

/** Öğrenciye: haftalık programı geride kaldıysa (perşembe-pazar, 18:00-21:00, haftada bir kez). */
export async function sendPlanNudges(now = new Date()): Promise<number> {
  const minutes = toLocalMinutes(now);
  const today = toLocalDateString(now);
  if (minutes < 18 * 60 || minutes > 21 * 60 || isoWeekday(today) < 4) return 0;
  const weekStart = weekStartOf(today);
  const students = await db.centerStudent.findMany({
    where: {
      status: "ACTIVE",
      center: { kind: "COACH", status: { not: "SUSPENDED" } },
      OR: [{ planNudgedWeek: null }, { planNudgedWeek: { lt: dateStringToDbDate(weekStart) } }],
      guardians: { some: { isStudentAccount: true, userId: { not: null } } },
      studyPlan: { some: { date: { gte: dateStringToDbDate(weekStart), lte: dateStringToDbDate(today) } } },
    },
    select: {
      id: true,
      firstName: true,
      guardians: { where: { isStudentAccount: true, userId: { not: null } }, select: { id: true, userId: true } },
      studyPlan: { where: { date: { gte: dateStringToDbDate(weekStart), lte: dateStringToDbDate(today) } }, select: { doneAt: true } },
    },
    take: 500,
  });
  let sent = 0;
  for (const s of students) {
    const total = s.studyPlan.length;
    const done = s.studyPlan.filter((p) => p.doneAt).length;
    if (total < 3 || done / total >= 0.4) continue;
    await db.centerStudent.update({ where: { id: s.id }, data: { planNudgedWeek: dateStringToDbDate(weekStart) } });
    for (const g of s.guardians) {
      await notify({ userId: g.userId!, type: "center.koc_plan", title: "Haftalık programın geride", body: `${s.firstName}, bu hafta ${total} görevin ${done} tanesini işaretledin. Kalan günlerde yetişebilirsin; yaptıklarını işaretlemeyi unutma.`, link: `/kocum/${g.id}` });
      sent++;
    }
  }
  return sent;
}

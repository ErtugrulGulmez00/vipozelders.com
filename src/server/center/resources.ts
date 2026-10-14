import { addDaysToDateString, dateStringToDbDate, isoWeekday } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";

// Kaynak/kitap takibi ve haftalık çalışma programı.
// Kurum kaynakları konu listesiyle tanımlar ve öğrencilere atar; öğrenci konu konu çözdüğü soru, doğru ve yanlışı
// girer (kurum personeli ya da portaldan öğrenci/veli). Program gün gün ders/konu/hedef soru içerir.

export type ResourceInput = { name: string; subject: string; publisher: string | null; topics: string[] };

/** Satır satır yazılmış konu listesini temizler (boş ve tekrar eden satırlar atılır). */
export function parseTopics(text: string): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const topic = line.replace(/^\s*[-•*\d.)]+\s*/, "").trim().slice(0, 120);
    if (topic && !seen.has(topic.toLocaleLowerCase("tr-TR"))) {
      seen.add(topic.toLocaleLowerCase("tr-TR"));
      topics.push(topic);
    }
  }
  return topics.slice(0, 200);
}

export async function createResource(ctx: CenterContext, input: ResourceInput) {
  if (!input.topics.length) throw new CenterError("En az bir konu yazın.", { topics: "Her satıra bir konu." });
  return db.centerResource.create({ data: { centerId: ctx.center.id, ...input } });
}

export async function getResourceOrThrow(ctx: CenterContext, resourceId: string) {
  const resource = await db.centerResource.findFirst({ where: { id: resourceId, centerId: ctx.center.id } });
  if (!resource) throw new CenterError("Kaynak bulunamadı.");
  return resource;
}

export async function updateResource(ctx: CenterContext, resourceId: string, input: ResourceInput & { isActive: boolean }) {
  await getResourceOrThrow(ctx, resourceId);
  if (!input.topics.length) throw new CenterError("En az bir konu yazın.", { topics: "Her satıra bir konu." });
  return db.centerResource.update({ where: { id: resourceId }, data: input });
}

export async function deleteResource(ctx: CenterContext, resourceId: string) {
  await getResourceOrThrow(ctx, resourceId);
  await db.centerResource.delete({ where: { id: resourceId } });
}

/** Kaynağı sınıfa ya da seçilen öğrencilere atar; zaten atanmış olanlar atlanır. */
export async function assignResource(ctx: CenterContext, resourceId: string, input: { groupId: string | null; studentIds: string[] }) {
  await getResourceOrThrow(ctx, resourceId);
  if (!input.groupId && !input.studentIds.length) throw new CenterError("Sınıf ya da öğrenci seçin.", { groupId: "Seçin." });
  const students = await db.centerStudent.findMany({
    where: {
      centerId: ctx.center.id,
      status: "ACTIVE",
      OR: [...(input.groupId ? [{ groups: { some: { groupId: input.groupId } } }] : []), ...(input.studentIds.length ? [{ id: { in: input.studentIds } }] : [])],
    },
    select: { id: true },
  });
  if (!students.length) throw new CenterError("Seçilen sınıfta aktif öğrenci yok.");
  const result = await db.centerStudentResource.createMany({ data: students.map((s) => ({ studentId: s.id, resourceId })), skipDuplicates: true });
  return { added: result.count, total: students.length };
}

export async function unassignResource(ctx: CenterContext, studentResourceId: string) {
  const row = await db.centerStudentResource.findFirst({ where: { id: studentResourceId, student: { centerId: ctx.center.id } } });
  if (!row) throw new CenterError("Kayıt bulunamadı.");
  await db.centerStudentResource.delete({ where: { id: studentResourceId } });
}

export type ProgressRow = { topic: string; solved: number; correct: number; wrong: number; done: boolean };

/** Öğrencinin bir kaynaktaki konu ilerlemesini kaydeder (yalnızca kaynağın konuları). */
export async function saveResourceProgress(studentResourceId: string, rows: ProgressRow[]) {
  const row = await db.centerStudentResource.findUniqueOrThrow({ where: { id: studentResourceId }, include: { resource: { select: { topics: true } }, progress: true } });
  const allowed = new Set(row.resource.topics);
  const existing = new Map(row.progress.map((p) => [p.topic, p]));
  const now = new Date();
  const ops = rows
    .filter((r) => allowed.has(r.topic))
    .map((r) => {
      const correct = clamp(r.correct);
      const wrong = clamp(r.wrong);
      const solved = Math.max(clamp(r.solved), correct + wrong);
      const prev = existing.get(r.topic);
      const completedAt = r.done ? (prev?.completedAt ?? now) : null;
      return db.centerResourceProgress.upsert({
        where: { studentResourceId_topic: { studentResourceId, topic: r.topic } },
        create: { studentResourceId, topic: r.topic, solved, correct, wrong, completedAt },
        update: { solved, correct, wrong, completedAt },
      });
    });
  await db.$transaction(ops);
  return ops.length;
}

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(100_000, Math.max(0, Math.round(n))) : 0);

/** Öğrenciye atanmış kaynak ve konu ilerlemesi özeti. */
export function resourceSummary(topics: string[], progress: { topic: string; solved: number; correct: number; wrong: number; completedAt: Date | null }[]) {
  const byTopic = new Map(progress.map((p) => [p.topic, p]));
  const rows = topics.map((topic) => {
    const p = byTopic.get(topic);
    const answered = (p?.correct ?? 0) + (p?.wrong ?? 0);
    return { topic, solved: p?.solved ?? 0, correct: p?.correct ?? 0, wrong: p?.wrong ?? 0, done: Boolean(p?.completedAt), accuracy: answered ? (p!.correct / answered) : null };
  });
  const doneCount = rows.filter((r) => r.done).length;
  const correct = rows.reduce((t, r) => t + r.correct, 0);
  const wrong = rows.reduce((t, r) => t + r.wrong, 0);
  return {
    rows,
    doneCount,
    completion: topics.length ? doneCount / topics.length : 0,
    solved: rows.reduce((t, r) => t + r.solved, 0),
    accuracy: correct + wrong ? correct / (correct + wrong) : null,
  };
}

// ---------------------------------------------------------------------------
// Haftalık çalışma programı
// ---------------------------------------------------------------------------

/** Verilen günün haftasının pazartesisi (YYYY-AA-GG). */
export function weekStartOf(date: string): string {
  return addDaysToDateString(date, 1 - isoWeekday(date));
}

export type PlanItemInput = { date: string; subject: string; topic: string | null; resourceId: string | null; targetQuestions: number | null; note: string | null };

export async function addPlanItem(ctx: CenterContext, studentId: string, input: PlanItemInput) {
  const student = await db.centerStudent.findFirst({ where: { id: studentId, centerId: ctx.center.id }, select: { id: true } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  if (input.resourceId) await getResourceOrThrow(ctx, input.resourceId);
  return db.centerStudyPlanItem.create({ data: { centerId: ctx.center.id, studentId, ...input, date: dateStringToDbDate(input.date) } });
}

export async function deletePlanItem(ctx: CenterContext, itemId: string) {
  const item = await db.centerStudyPlanItem.findFirst({ where: { id: itemId, centerId: ctx.center.id } });
  if (!item) throw new CenterError("Kayıt bulunamadı.");
  await db.centerStudyPlanItem.delete({ where: { id: itemId } });
}

/** Bir haftanın programını sonraki haftaya kopyalar (tamamlandı işaretleri kopyalanmaz). */
export async function copyPlanWeek(ctx: CenterContext, studentId: string, weekStart: string) {
  const items = await db.centerStudyPlanItem.findMany({
    where: { centerId: ctx.center.id, studentId, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(addDaysToDateString(weekStart, 7)) } },
  });
  if (!items.length) throw new CenterError("Bu haftada kopyalanacak program yok.");
  await db.centerStudyPlanItem.createMany({
    data: items.map((i) => ({
      centerId: i.centerId,
      studentId: i.studentId,
      date: new Date(i.date.getTime() + 7 * 24 * 3_600_000),
      subject: i.subject,
      topic: i.topic,
      resourceId: i.resourceId,
      targetQuestions: i.targetQuestions,
      note: i.note,
    })),
  });
  return items.length;
}

/** Program maddesini tamamlandı / tamamlanmadı yapar. Erişim kontrolü çağıran tarafta yapılır. */
export async function setPlanItemDone(itemId: string, done: boolean) {
  await db.centerStudyPlanItem.update({ where: { id: itemId }, data: { doneAt: done ? new Date() : null } });
}

/** Portaldan (öğrenci/veli) erişim: kullanıcının bağlı olduğu öğrenciye ait mi? */
export async function portalStudentIdFor(userId: string, studentId: string) {
  const link = await db.centerGuardian.findFirst({ where: { userId, studentId, student: { status: "ACTIVE", center: { status: { not: "SUSPENDED" } } } }, select: { studentId: true } });
  return link?.studentId ?? null;
}

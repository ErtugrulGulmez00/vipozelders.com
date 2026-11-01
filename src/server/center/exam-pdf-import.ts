import type { Prisma } from "@/generated/prisma/client";
import { computeNet } from "@/lib/center/exams";
import { aliasKey, matchStudents, type MatchCandidate, type StudentMatch } from "@/lib/center/exam-match";
import { parseResultPdf, type PdfExam } from "@/lib/center/exam-pdf";
import { dateStringToDbDate } from "@/lib/dates";
import { normalizeSearch } from "@/lib/text";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { recomputeExam, upsertResult } from "./exams";
import { readPdfItems } from "./pdf-text";

// Yayınevi sonuç PDF'inden deneme aktarımı: PDF okunur → taslak → eşleştirme ekranında onay → deneme ve sonuçlar.

const MAX_BYTES = 25 * 1024 * 1024;
const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type PdfImportData = { exams: PdfExam[] };

/** Konu adları anahtar ekranındaki sınırla (120) aynı; kazanım yazılmamış soru konusuz kalır. */
function cleanTopic(topic: string): string {
  if (!topic || /^KAZANIM BEL[İI]RT[İI]LMEM[İI]Ş/i.test(topic)) return "";
  return topic.length > 120 ? `${topic.slice(0, 119).trimEnd()}…` : topic;
}

export async function createPdfImport(ctx: CenterContext, file: File | null): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new CenterError("Sonuç PDF'ini seçin.", { file: "Dosya gerekli." });
  if (file.size > MAX_BYTES) throw new CenterError("PDF en fazla 25 MB olabilir.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new CenterError("Dosya PDF değil. Yayınevinin sonuç sisteminden indirdiğiniz PDF'i seçin.");
  let pages;
  try {
    pages = await readPdfItems(bytes);
  } catch {
    throw new CenterError("PDF açılamadı. Dosya şifreli ya da bozuk olabilir.");
  }
  if (!pages.some((p) => p.length)) throw new CenterError("PDF'te okunabilir yazı yok (taranmış/fotoğraf PDF). Yayınevi sisteminden indirilen orijinal PDF'i yükleyin.");
  const parsed = parseResultPdf(pages);
  if (!parsed.exams.length) {
    throw new CenterError("Bu PDF'te öğrenci sonuç belgesi bulunamadı; bu rapor biçimi henüz tanınmıyor. PDF'i bize gönderin, ekleyelim. O zamana kadar Excel ile aktarabilirsiniz.");
  }
  const data: PdfImportData = {
    exams: parsed.exams.map((e) => ({ ...e, sections: e.sections.map((s) => ({ ...s, topics: s.topics.map(cleanTopic) })) })),
  };
  await db.centerExamImport.deleteMany({ where: { centerId: ctx.center.id, createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } } });
  const draft = await db.centerExamImport.create({
    data: { centerId: ctx.center.id, fileName: file.name.slice(0, 200), data: data as unknown as Prisma.InputJsonValue },
  });
  return draft.id;
}

async function findDraft(ctx: CenterContext, draftId: string) {
  const draft = await db.centerExamImport.findFirst({ where: { id: draftId, centerId: ctx.center.id } });
  if (!draft) throw new CenterError("Aktarım bulunamadı ya da süresi doldu; PDF'i yeniden yükleyin.");
  return { ...draft, data: draft.data as unknown as PdfImportData };
}

async function candidatesFor(centerId: string): Promise<(MatchCandidate & { status: string })[]> {
  const students = await db.centerStudent.findMany({
    where: { centerId },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, studentNumber: true, status: true, groups: { select: { group: { select: { name: true } } } } },
  });
  return students.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, studentNumber: s.studentNumber, status: s.status, groups: s.groups.map((g) => g.group.name) }));
}

/** Aynı adlı ve aynı ders yapısındaki deneme varsa sonuçlar onun üzerine yazılır (PDF iki kez yüklenirse çift deneme olmaz). */
async function existingExam(centerId: string, exam: Pick<PdfExam, "name" | "sections">, name = exam.name) {
  const sameName = await db.centerExam.findMany({
    where: { centerId, name: { equals: name.trim(), mode: "insensitive" } },
    include: { sections: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return sameName.find((e) => e.sections.length === exam.sections.length && e.sections.every((s, i) => s.questionCount === exam.sections[i].questionCount)) ?? null;
}

export async function getPdfImport(ctx: CenterContext, draftId: string) {
  const draft = await findDraft(ctx, draftId);
  const candidates = await candidatesFor(ctx.center.id);
  const keys = draft.data.exams.flatMap((e) => e.students.map(aliasKey));
  const aliases = new Map(
    (await db.centerExamAlias.findMany({ where: { centerId: ctx.center.id, key: { in: keys } }, select: { key: true, studentId: true } })).map((a) => [a.key, a.studentId]),
  );
  const exams = await Promise.all(
    draft.data.exams.map(async (exam) => {
      const matches: StudentMatch[] = matchStudents(exam.students, candidates, aliases);
      const existing = await existingExam(ctx.center.id, exam);
      return { exam, matches, existing: existing ? { id: existing.id, name: existing.name } : null };
    }),
  );
  return { draft: { id: draft.id, fileName: draft.fileName, createdAt: draft.createdAt }, exams, candidates };
}

export type PdfImportChoice = { use: boolean; name: string; date: string; publisher: string | null; studentIds: (string | null)[] };

export async function confirmPdfImport(ctx: CenterContext, draftId: string, choices: PdfImportChoice[]) {
  const draft = await findDraft(ctx, draftId);
  const exams = draft.data.exams;
  if (choices.length !== exams.length) throw new CenterError("Form eksik geldi; sayfayı yenileyip tekrar deneyin.");
  if (!choices.some((c) => c.use)) throw new CenterError("Aktarılacak en az bir deneme seçin.");
  const studentIds = new Set((await db.centerStudent.findMany({ where: { centerId: ctx.center.id }, select: { id: true } })).map((s) => s.id));

  // Önce tüm seçimler doğrulanır; hata varsa hiçbir şey yazılmaz.
  for (const [index, choice] of choices.entries()) {
    if (!choice.use) continue;
    const exam = exams[index];
    const chosen = choice.studentIds.filter((id): id is string => Boolean(id));
    if (choice.studentIds.length !== exam.students.length) throw new CenterError("Form eksik geldi; sayfayı yenileyip tekrar deneyin.");
    if (!chosen.length) throw new CenterError(`${choice.name}: hiçbir öğrenci eşleştirilmedi.`);
    if (chosen.some((id) => !studentIds.has(id))) throw new CenterError("Seçilen öğrencilerden biri bulunamadı; sayfayı yenileyin.");
    const dup = chosen.find((id, i) => chosen.indexOf(id) !== i);
    if (dup) {
      const rows = choice.studentIds.flatMap((id, i) => (id === dup ? [exam.students[i].name || "Adsız"] : []));
      throw new CenterError(`${choice.name}: aynı öğrenci birden fazla satırda seçildi (${rows.join(", ")}).`);
    }
  }

  const examIds: string[] = [];
  let saved = 0;
  for (const [index, choice] of choices.entries()) {
    if (!choice.use) continue;
    const exam = exams[index];
    let target = await existingExam(ctx.center.id, exam, choice.name);
    if (!target) {
      const created = await db.centerExam.create({
        data: {
          centerId: ctx.center.id,
          name: choice.name,
          kind: exam.kind,
          date: dateStringToDbDate(choice.date),
          publisher: choice.publisher,
          wrongPenalty: exam.wrongPenalty,
          sections: {
            create: exam.sections.map((s, order) => ({ name: s.name, questionCount: s.questionCount, subjectSlug: s.subjectSlug, order, answerKey: s.answerKey, topics: s.topics.some(Boolean) ? s.topics : [] })),
          },
        },
        include: { sections: { orderBy: { order: "asc" } } },
      });
      target = created;
    } else {
      await db.centerExam.update({ where: { id: target.id }, data: { date: dateStringToDbDate(choice.date), publisher: choice.publisher ?? target.publisher } });
      for (const [i, section] of target.sections.entries()) {
        const src = exam.sections[i];
        if (!section.answerKey && src.answerKey) await db.centerExamSection.update({ where: { id: section.id }, data: { answerKey: src.answerKey } });
        if (!section.topics.length && src.topics.some(Boolean)) await db.centerExamSection.update({ where: { id: section.id }, data: { topics: src.topics } });
      }
    }
    const penalty = target.wrongPenalty;
    for (const [i, studentId] of choice.studentIds.entries()) {
      if (!studentId) continue;
      const pdf = exam.students[i];
      const rows = target.sections.flatMap((section, j) => {
        const s = pdf.sections[j];
        if (!s) return [];
        const answers = s.answers && s.answers.length === section.questionCount && /^[A-E-]+$/.test(s.answers) ? s.answers : null;
        const correct = Math.max(0, Math.min(s.correct, section.questionCount));
        const wrong = Math.max(0, Math.min(s.wrong, section.questionCount - correct));
        return [{ sectionId: section.id, correct, wrong, blank: section.questionCount - correct - wrong, net: computeNet(correct, wrong, penalty), answers }];
      });
      if (!rows.length) continue;
      await upsertResult(target.id, studentId, rows, pdf.score);
      await db.centerExamResult.update({
        where: { examId_studentId: { examId: target.id, studentId } },
        data: { externalRanks: pdf.ranks.length ? (pdf.ranks as unknown as Prisma.InputJsonValue) : undefined },
      });
      // Adsız formlar hatırlanmaz (yalnızca numarayla eşleşme yanıltıcı olur).
      if (normalizeSearch(pdf.name)) {
        const key = aliasKey(pdf);
        await db.centerExamAlias.upsert({ where: { centerId_key: { centerId: ctx.center.id, key } }, create: { centerId: ctx.center.id, key, studentId }, update: { studentId } });
      }
      saved++;
    }
    await recomputeExam(target.id);
    examIds.push(target.id);
  }
  await db.centerExamImport.delete({ where: { id: draft.id } });
  return { examIds, saved };
}

export async function discardPdfImport(ctx: CenterContext, draftId: string) {
  await db.centerExamImport.deleteMany({ where: { id: draftId, centerId: ctx.center.id } });
}

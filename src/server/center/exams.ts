import { dateStringToDbDate, formatDate } from "@/lib/dates";
import {
  AnswerFormatError,
  competitionRanks,
  computeNet,
  EXAM_PRESETS,
  formatNet,
  gradeAnswers,
  normalizeAnswers,
  parseTopics,
  round2,
  type ExamKindName,
  type QuestionOutcome,
  type TopicStat,
  topicBreakdown,
} from "@/lib/center/exams";
import { parseOpticFile } from "@/lib/center/optic";
import { normalizeSearch } from "@/lib/text";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Deneme sınavları: oluşturma, cevap anahtarı ve konu dağılımı, sonuç girişi (elle / cevaplarla / Excel), sıralama, analiz.

export type SectionInput = { name: string; questionCount: number; subjectSlug: string | null };

export async function createExam(ctx: CenterContext, input: { name: string; kind: ExamKindName; date: string; publisher: string | null; wrongPenalty: number | null; sections: SectionInput[] }) {
  const preset = EXAM_PRESETS[input.kind];
  const sections = input.kind === "CUSTOM" ? input.sections : preset.sections;
  if (!sections.length) throw new CenterError("Serbest denemede en az bir ders (bölüm) tanımlayın.");
  if (sections.some((s) => s.questionCount < 1 || s.questionCount > 200)) throw new CenterError("Soru sayısı 1-200 arasında olmalı.");
  return db.centerExam.create({
    data: {
      centerId: ctx.center.id,
      name: input.name,
      kind: input.kind,
      date: dateStringToDbDate(input.date),
      publisher: input.publisher,
      wrongPenalty: input.wrongPenalty ?? preset.wrongPenalty,
      sections: { create: sections.map((s, order) => ({ name: s.name, questionCount: s.questionCount, subjectSlug: s.subjectSlug, order, topics: [] })) },
    },
  });
}

export async function getExamOrThrow(ctx: CenterContext, examId: string) {
  const exam = await db.centerExam.findFirst({ where: { id: examId, centerId: ctx.center.id }, include: { sections: { orderBy: { order: "asc" } } } });
  if (!exam) throw new CenterError("Deneme bulunamadı.");
  return exam;
}

export async function updateExamMeta(ctx: CenterContext, examId: string, input: { name: string; date: string; publisher: string | null; wrongPenalty: number }) {
  await getExamOrThrow(ctx, examId);
  await db.centerExam.update({ where: { id: examId }, data: { name: input.name, date: dateStringToDbDate(input.date), publisher: input.publisher, wrongPenalty: input.wrongPenalty } });
  await recomputeExam(examId);
}

export async function deleteExam(ctx: CenterContext, examId: string) {
  await getExamOrThrow(ctx, examId);
  await db.centerExam.delete({ where: { id: examId } });
}

/** Cevap anahtarı ve konu dağılımı; anahtar değişirse cevabı girilmiş sonuçlar yeniden okunur. */
export async function saveAnswerKey(ctx: CenterContext, examId: string, sectionId: string, keyText: string, topicsText: string) {
  const exam = await getExamOrThrow(ctx, examId);
  const section = exam.sections.find((s) => s.id === sectionId);
  if (!section) throw new CenterError("Bölüm bulunamadı.");
  let key: string | null = null;
  if (keyText.trim()) {
    try {
      key = normalizeAnswers(keyText, { allowCancelled: true });
    } catch (error) {
      if (error instanceof AnswerFormatError) throw new CenterError(`${section.name}: ${error.message}`);
      throw error;
    }
    if (key.includes("-")) throw new CenterError(`${section.name}: cevap anahtarında boş soru olamaz (iptal edilen soru için X yazın).`);
    if (key.length !== section.questionCount) throw new CenterError(`${section.name}: ${section.questionCount} soru var, anahtarda ${key.length} cevap yazılmış.`);
  }
  const { topics, errors } = parseTopics(topicsText, section.questionCount);
  if (errors.length) throw new CenterError(`${section.name} konu dağılımı: ${errors[0]}`);
  await db.centerExamSection.update({ where: { id: sectionId }, data: { answerKey: key, topics: topics.some(Boolean) ? topics : [] } });
  if (key) {
    const results = await db.centerExamSectionResult.findMany({ where: { sectionId, answers: { not: null } } });
    for (const r of results) {
      const graded = gradeAnswers(key, r.answers!.slice(0, key.length));
      await db.centerExamSectionResult.update({
        where: { id: r.id },
        data: { correct: graded.correct, wrong: graded.wrong, blank: graded.blank, net: computeNet(graded.correct, graded.wrong, exam.wrongPenalty) },
      });
    }
    if (results.length) await recomputeExam(examId);
  }
}

export type SectionScore = { sectionId: string; correct: number; wrong: number; answers?: string | null };

type ExamWithSections = Awaited<ReturnType<typeof getExamOrThrow>>;

function scoreSections(exam: ExamWithSections, scores: SectionScore[], studentLabel: string) {
  return scores.map((s) => {
    const section = exam.sections.find((x) => x.id === s.sectionId);
    if (!section) throw new CenterError("Bölüm bulunamadı.");
    if (s.answers) {
      if (!section.answerKey) throw new CenterError(`${section.name} için önce cevap anahtarını girin.`);
      let answers: string;
      try {
        answers = normalizeAnswers(s.answers);
        const graded = gradeAnswers(section.answerKey, answers);
        return { sectionId: section.id, correct: graded.correct, wrong: graded.wrong, blank: graded.blank, net: computeNet(graded.correct, graded.wrong, exam.wrongPenalty), answers };
      } catch (error) {
        if (error instanceof AnswerFormatError) throw new CenterError(`${studentLabel} · ${section.name}: ${error.message}`);
        throw error;
      }
    }
    if (s.correct < 0 || s.wrong < 0 || s.correct + s.wrong > section.questionCount) {
      throw new CenterError(`${studentLabel} · ${section.name}: doğru + yanlış en fazla ${section.questionCount} olabilir.`);
    }
    return { sectionId: section.id, correct: s.correct, wrong: s.wrong, blank: section.questionCount - s.correct - s.wrong, net: computeNet(s.correct, s.wrong, exam.wrongPenalty), answers: null };
  });
}

async function upsertResult(examId: string, studentId: string, sections: ReturnType<typeof scoreSections>, score: number | null | undefined) {
  const totals = {
    correct: sections.reduce((n, s) => n + s.correct, 0),
    wrong: sections.reduce((n, s) => n + s.wrong, 0),
    blank: sections.reduce((n, s) => n + s.blank, 0),
    net: round2(sections.reduce((n, s) => n + s.net, 0)),
  };
  const result = await db.centerExamResult.upsert({
    where: { examId_studentId: { examId, studentId } },
    create: { examId, studentId, ...totals, score: score ?? null },
    update: { ...totals, ...(score !== undefined ? { score } : {}) },
  });
  for (const s of sections) {
    await db.centerExamSectionResult.upsert({
      where: { resultId_sectionId: { resultId: result.id, sectionId: s.sectionId } },
      create: { resultId: result.id, ...s },
      update: { correct: s.correct, wrong: s.wrong, blank: s.blank, net: s.net, answers: s.answers },
    });
  }
}

/** Toplamları bölümlerden yeniden hesaplar ve sıralamayı günceller. */
export async function recomputeExam(examId: string) {
  const exam = await db.centerExam.findUniqueOrThrow({ where: { id: examId }, include: { results: { include: { sections: true } } } });
  const totals = exam.results.map((r) => {
    const sections = r.sections.map((s) => ({ id: s.id, correct: s.correct, wrong: s.wrong, blank: s.blank, net: computeNet(s.correct, s.wrong, exam.wrongPenalty), changed: false }));
    sections.forEach((s, i) => (s.changed = s.net !== r.sections[i].net));
    return {
      id: r.id,
      sections,
      correct: sections.reduce((n, s) => n + s.correct, 0),
      wrong: sections.reduce((n, s) => n + s.wrong, 0),
      blank: sections.reduce((n, s) => n + s.blank, 0),
      net: round2(sections.reduce((n, s) => n + s.net, 0)),
    };
  });
  const ranks = competitionRanks(totals.map((t) => t.net));
  await db.$transaction([
    ...totals.map((t, i) => db.centerExamResult.update({ where: { id: t.id }, data: { correct: t.correct, wrong: t.wrong, blank: t.blank, net: t.net, rank: ranks[i] } })),
    // Yanlış götürme kuralı değiştiyse bölüm netleri de güncellenir.
    ...totals.flatMap((t) => t.sections.filter((s) => s.changed).map((s) => db.centerExamSectionResult.update({ where: { id: s.id }, data: { net: s.net } }))),
  ]);
}

export type GridRow = { studentId: string; sections: SectionScore[]; score?: number | null; clear?: boolean };

/** Sonuç tablosundan toplu kayıt (doğru/yanlış sayıları). Boş bırakılan satırlar atlanır. */
export async function saveResultsGrid(ctx: CenterContext, examId: string, rows: GridRow[]) {
  const exam = await getExamOrThrow(ctx, examId);
  const students = new Map(
    (await db.centerStudent.findMany({ where: { centerId: ctx.center.id, id: { in: rows.map((r) => r.studentId) } }, select: { id: true, firstName: true, lastName: true } })).map((s) => [s.id, s]),
  );
  // Cevaplarla okunmuş bir dersin D/Y'si tabloda değişmediyse cevaplar (konu analizi) korunur.
  const existing = await db.centerExamSectionResult.findMany({
    where: { result: { examId, studentId: { in: [...students.keys()] } }, answers: { not: null } },
    select: { sectionId: true, correct: true, wrong: true, answers: true, result: { select: { studentId: true } } },
  });
  const answered = new Map(existing.map((e) => [`${e.result.studentId}:${e.sectionId}`, e]));
  let saved = 0;
  let cleared = 0;
  for (const row of rows) {
    const student = students.get(row.studentId);
    if (!student) continue;
    if (row.clear) {
      const deleted = await db.centerExamResult.deleteMany({ where: { examId, studentId: student.id } });
      cleared += deleted.count;
      continue;
    }
    const scores = row.sections.map((s) => {
      const prev = answered.get(`${student.id}:${s.sectionId}`);
      return prev && prev.correct === s.correct && prev.wrong === s.wrong ? { ...s, answers: prev.answers } : s;
    });
    const sections = scoreSections(exam, scores, `${student.firstName} ${student.lastName}`);
    await upsertResult(examId, student.id, sections, row.score);
    saved++;
  }
  await recomputeExam(examId);
  return { saved, cleared };
}

/** Bir öğrencinin cevaplarını anahtarla okur (konu analizi için). */
export async function saveStudentAnswers(ctx: CenterContext, examId: string, studentId: string, answers: { sectionId: string; answers: string }[], score: number | null) {
  const exam = await getExamOrThrow(ctx, examId);
  const student = await db.centerStudent.findFirst({ where: { id: studentId, centerId: ctx.center.id } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  const filled = answers.filter((a) => a.answers.trim());
  if (!filled.length) throw new CenterError("En az bir dersin cevaplarını yazın.");
  const sections = scoreSections(exam, filled.map((a) => ({ sectionId: a.sectionId, correct: 0, wrong: 0, answers: a.answers })), `${student.firstName} ${student.lastName}`);
  await upsertResult(examId, studentId, sections, score);
  await recomputeExam(examId);
}

export type ExamImportSummary = { saved: number; problems: { row: number; message: string }[] };

/**
 * Excel'den sonuç aktarımı. Sütunlar: "Öğrenci No" (ya da "Ad Soyad"), her ders için
 * "<Ders> D" + "<Ders> Y" ya da "<Ders> Cevap", isteğe bağlı "Puan".
 */
export async function importExamResults(ctx: CenterContext, examId: string, table: string[][]): Promise<ExamImportSummary> {
  const exam = await getExamOrThrow(ctx, examId);
  if (table.length < 2) throw new CenterError("Dosyada başlık satırından sonra sonuç bulunamadı.");
  const headers = table[0].map((h) => normalizeSearch(h));
  const find = (...names: string[]) => headers.findIndex((h) => names.includes(h));
  const numberCol = find("ogrenci no", "no", "numara", "ogrenci numarasi");
  const nameCol = find("ad soyad", "adi soyadi", "ogrenci", "ogrenci adi soyadi", "ogrenci ad soyad");
  const scoreCol = find("puan", "toplam puan");
  if (numberCol < 0 && nameCol < 0) throw new CenterError("Başlıkta “Öğrenci No” ya da “Ad Soyad” sütunu bulunamadı.");

  const columns = exam.sections.map((section) => {
    const base = normalizeSearch(section.name);
    const col = (suffixes: string[]) => headers.findIndex((h) => suffixes.some((suffix) => h === `${base} ${suffix}`));
    return { section, correct: col(["d", "dogru"]), wrong: col(["y", "yanlis"]), answers: col(["cevap", "cevaplar", "cevaplari"]) };
  });
  if (columns.every((c) => c.correct < 0 && c.answers < 0)) {
    throw new CenterError(`Ders sütunları bulunamadı. Örnek başlık: “${exam.sections[0]?.name} D”, “${exam.sections[0]?.name} Y”. Şablonu indirip kullanabilirsiniz.`);
  }

  const students = await db.centerStudent.findMany({ where: { centerId: ctx.center.id }, select: { id: true, studentNumber: true, firstName: true, lastName: true } });
  const byNumber = new Map(students.filter((s) => s.studentNumber).map((s) => [s.studentNumber!, s]));
  const byName = new Map(students.map((s) => [normalizeSearch(`${s.firstName} ${s.lastName}`), s]));
  const summary: ExamImportSummary = { saved: 0, problems: [] };

  for (const [index, cells] of table.slice(1).entries()) {
    const rowNumber = index + 2;
    const number = numberCol >= 0 ? (cells[numberCol] ?? "").trim() : "";
    const name = nameCol >= 0 ? (cells[nameCol] ?? "").trim() : "";
    if (!number && !name) continue;
    const student = (number && byNumber.get(number)) || (name && byName.get(normalizeSearch(name))) || null;
    if (!student) {
      summary.problems.push({ row: rowNumber, message: `${number || name}: öğrenci bulunamadı.` });
      continue;
    }
    const num = (i: number) => (i >= 0 ? Number(String(cells[i] ?? "").replace(",", ".")) || 0 : 0);
    const scores: SectionScore[] = [];
    for (const c of columns) {
      const answers = c.answers >= 0 ? (cells[c.answers] ?? "").trim() : "";
      if (answers) scores.push({ sectionId: c.section.id, correct: 0, wrong: 0, answers });
      else if (c.correct >= 0 && (String(cells[c.correct] ?? "").trim() || String(cells[c.wrong] ?? "").trim())) {
        scores.push({ sectionId: c.section.id, correct: Math.round(num(c.correct)), wrong: Math.round(num(c.wrong)) });
      }
    }
    if (!scores.length) continue;
    try {
      const sections = scoreSections(exam, scores, `${student.firstName} ${student.lastName}`);
      const rawScore = scoreCol >= 0 ? String(cells[scoreCol] ?? "").trim() : "";
      await upsertResult(examId, student.id, sections, rawScore ? Number(rawScore.replace(",", ".")) || null : undefined);
      summary.saved++;
    } catch (error) {
      summary.problems.push({ row: rowNumber, message: error instanceof CenterError ? error.message : "Kaydedilemedi." });
    }
  }
  await recomputeExam(examId);
  return summary;
}

// ---------------------------------------------------------------------------
// Optik okuyucu (sabit konumlu TXT/DAT) aktarımı
// ---------------------------------------------------------------------------

export type OpticTemplateInput = { name: string; numberStart: number; numberLength: number; nameStart: number | null; nameLength: number | null; sections: { start: number; length: number }[] };

export async function saveOpticTemplate(ctx: CenterContext, templateId: string | null, input: OpticTemplateInput) {
  if (!input.sections.length) throw new CenterError("En az bir ders için cevap konumu girin.", { sections: "Örn: 40:20" });
  if (templateId) {
    const existing = await db.centerOpticTemplate.findFirst({ where: { id: templateId, centerId: ctx.center.id } });
    if (!existing) throw new CenterError("Şablon bulunamadı.");
    return db.centerOpticTemplate.update({ where: { id: templateId }, data: input });
  }
  return db.centerOpticTemplate.create({ data: { centerId: ctx.center.id, ...input } });
}

export async function deleteOpticTemplate(ctx: CenterContext, templateId: string) {
  const existing = await db.centerOpticTemplate.findFirst({ where: { id: templateId, centerId: ctx.center.id } });
  if (!existing) throw new CenterError("Şablon bulunamadı.");
  await db.centerOpticTemplate.delete({ where: { id: templateId } });
}

/**
 * Optik okuyucu dosyasını şablona göre okur; öğrenciler numarayla (yoksa adla) eşleşir. Şablondaki ders sırası
 * sınavın ders sırasıyla eşleşir. Çift işaretli (*) cevap yanlış sayılır. Yalnızca cevap anahtarı girilmiş dersler okunur.
 */
export async function importOpticResults(ctx: CenterContext, examId: string, templateId: string, text: string): Promise<ExamImportSummary> {
  const exam = await getExamOrThrow(ctx, examId);
  const template = await db.centerOpticTemplate.findFirst({ where: { id: templateId, centerId: ctx.center.id } });
  if (!template) throw new CenterError("Optik şablon bulunamadı.");
  const positions = template.sections as { start: number; length: number }[];
  const mapped = exam.sections.slice(0, positions.length).map((section, index) => ({ section, index }));
  const keyed = mapped.filter((m) => m.section.answerKey);
  if (!keyed.length) throw new CenterError("Optik okuma için en az bir dersin cevap anahtarını girin.");
  const rows = parseOpticFile(text, { ...template, sections: positions });
  if (!rows.length) throw new CenterError("Dosyada okunacak satır bulunamadı.");

  const students = await db.centerStudent.findMany({ where: { centerId: ctx.center.id }, select: { id: true, studentNumber: true, firstName: true, lastName: true } });
  const byNumber = new Map(students.filter((s) => s.studentNumber).map((s) => [s.studentNumber!.replace(/^0+(?=\d)/, ""), s]));
  const byName = new Map(students.map((s) => [normalizeSearch(`${s.firstName} ${s.lastName}`), s]));
  const summary: ExamImportSummary = { saved: 0, problems: [] };
  for (const row of rows) {
    const student = (row.number && byNumber.get(row.number)) || (row.name && byName.get(normalizeSearch(row.name))) || null;
    if (!student) {
      summary.problems.push({ row: row.line, message: `${row.number || row.name || "Numarasız form"}: öğrenci bulunamadı.` });
      continue;
    }
    const scores: SectionScore[] = keyed.map(({ section, index }) => {
      const key = section.answerKey!;
      const answers = [...row.answers[index].slice(0, key.length)]
        .map((c, q) => (c === "*" ? "ABCDE".replace(key[q] ?? "", "")[0] : c))
        .join("");
      return { sectionId: section.id, correct: 0, wrong: 0, answers };
    });
    try {
      await upsertResult(examId, student.id, scoreSections(exam, scores, `${student.firstName} ${student.lastName}`), undefined);
      summary.saved++;
    } catch (error) {
      summary.problems.push({ row: row.line, message: error instanceof CenterError ? error.message : "Kaydedilemedi." });
    }
  }
  await recomputeExam(examId);
  return summary;
}
/** Sonuçları velilere açar; ilk yayında hesabı bağlı velilere bildirim (isteğe bağlı e-posta/SMS) gider. */
export async function publishExam(ctx: CenterContext, examId: string, publish: boolean, channels: { email: boolean; sms: boolean }) {
  const exam = await getExamOrThrow(ctx, examId);
  await db.centerExam.update({ where: { id: examId }, data: { isPublished: publish } });
  if (!publish || exam.isPublished) return 0;
  const results = await db.centerExamResult.findMany({ where: { examId }, include: { student: { select: { id: true, firstName: true, lastName: true } } } });
  const total = results.length;
  for (const r of results) {
    const name = `${r.student.firstName} ${r.student.lastName}`;
    const summary = `${exam.name}: ${formatNet(r.net)} net${r.rank ? `, kurum sırası ${r.rank}/${total}` : ""}`;
    await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: r.student.id,
      kind: "exam_result",
      sms: channels.sms ? `${name} ${summary}. Ayrıntılar veli portalında.` : null,
      email: channels.email
        ? { subject: `Deneme sonucu: ${exam.name}`, title: `${r.student.firstName} için deneme sonucu`, lines: [`${name} · ${summary}.`, `Sınav tarihi: ${formatDate(exam.date)}.`, "Ders ve konu bazında ayrıntıları veli portalından görebilirsiniz."], action: { label: "Sonucu görüntüle", url: "/hesabim/kurum" } }
        : null,
      notification: { title: `Deneme sonucu: ${exam.name}`, body: `${r.student.firstName} · ${summary}` },
    });
  }
  return total;
}

// ---------------------------------------------------------------------------
// Analiz
// ---------------------------------------------------------------------------

/** Bu oranda ya da altında doğru yapılan konu “eksik” sayılır (4 sorudan 2 doğru dahil). */
export const WEAK_TOPIC_RATE = 0.5;

export type SectionAverage = { sectionId: string; name: string; questionCount: number; correct: number; wrong: number; blank: number; net: number; maxNet: number };

export function outcomesFor(section: { answerKey: string | null }, answers: string | null): QuestionOutcome[] | null {
  if (!section.answerKey || !answers) return null;
  try {
    return gradeAnswers(section.answerKey, answers.slice(0, section.answerKey.length)).outcomes;
  } catch {
    return null;
  }
}

/** Deneme analizi: ortalamalar, sıralama listesi, konu ve soru bazında sınıf başarısı. */
export async function examAnalysis(centerId: string, examId: string, groupId?: string | null) {
  const exam = await db.centerExam.findFirst({ where: { id: examId, centerId }, include: { sections: { orderBy: { order: "asc" } } } });
  if (!exam) return null;
  const results = await db.centerExamResult.findMany({
    where: { examId, ...(groupId ? { student: { groups: { some: { groupId } } } } : {}) },
    include: {
      sections: true,
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, groups: { select: { group: { select: { name: true } } } } } },
    },
    orderBy: [{ net: "desc" }],
  });
  const n = results.length;
  const sectionAverages: SectionAverage[] = exam.sections.map((section) => {
    const rows = results.map((r) => r.sections.find((s) => s.sectionId === section.id)).filter((s): s is NonNullable<typeof s> => Boolean(s));
    const avg = (pick: (s: (typeof rows)[number]) => number) => (rows.length ? round2(rows.reduce((t, s) => t + pick(s), 0) / rows.length) : 0);
    return {
      sectionId: section.id,
      name: section.name,
      questionCount: section.questionCount,
      correct: avg((s) => s.correct),
      wrong: avg((s) => s.wrong),
      blank: avg((s) => s.blank),
      net: avg((s) => s.net),
      maxNet: rows.length ? Math.max(...rows.map((s) => s.net)) : 0,
    };
  });
  const nets = results.map((r) => r.net);
  const topics: { sectionId: string; sectionName: string; stats: TopicStat[] }[] = [];
  const questions: { sectionId: string; sectionName: string; key: string; rates: { correct: number; wrong: number; blank: number; choices: Record<string, number> }[] }[] = [];
  for (const section of exam.sections) {
    if (!section.answerKey) continue;
    const answered = results.map((r) => r.sections.find((s) => s.sectionId === section.id)?.answers ?? null).filter((a): a is string => Boolean(a));
    if (!answered.length) continue;
    const outcomeSets = answered.map((a) => outcomesFor(section, a)).filter((o): o is QuestionOutcome[] => Boolean(o));
    if (section.topics.length) topics.push({ sectionId: section.id, sectionName: section.name, stats: topicBreakdown(section.topics, outcomeSets) });
    questions.push({
      sectionId: section.id,
      sectionName: section.name,
      key: section.answerKey,
      rates: [...section.answerKey].map((_, i) => {
        const choices: Record<string, number> = {};
        for (const a of answered) {
          const c = a[i] ?? "-";
          choices[c] = (choices[c] ?? 0) + 1;
        }
        return {
          correct: outcomeSets.filter((o) => o[i] === "C").length / outcomeSets.length,
          wrong: outcomeSets.filter((o) => o[i] === "W").length / outcomeSets.length,
          blank: outcomeSets.filter((o) => o[i] === "B").length / outcomeSets.length,
          choices,
        };
      }),
    });
  }
  return {
    exam,
    results,
    participants: n,
    average: n ? round2(nets.reduce((a, b) => a + b, 0) / n) : 0,
    max: n ? Math.max(...nets) : 0,
    min: n ? Math.min(...nets) : 0,
    sectionAverages,
    topics,
    questions,
  };
}

/** Öğrencinin bir denemedeki karnesi + aynı türdeki son denemelerde net gelişimi. */
export async function studentExamReport(centerId: string, examId: string, studentId: string, options: { publishedOnly?: boolean } = {}) {
  const analysis = await examAnalysis(centerId, examId);
  if (!analysis) return null;
  const result = analysis.results.find((r) => r.student.id === studentId);
  if (!result) return { analysis, result: null, sections: [], weakTopics: [], trend: [] };
  const sections = analysis.exam.sections.map((section) => {
    const own = result.sections.find((s) => s.sectionId === section.id) ?? null;
    const average = analysis.sectionAverages.find((a) => a.sectionId === section.id)!;
    const outcomes = own ? outcomesFor(section, own.answers) : null;
    return { section, own, average, outcomes, topics: outcomes && section.topics.length ? topicBreakdown(section.topics, [outcomes]) : [] };
  });
  const weakTopics = sections.flatMap((s) => s.topics.filter((t) => t.rate <= WEAK_TOPIC_RATE).map((t) => ({ ...t, sectionName: s.section.name, subjectSlug: s.section.subjectSlug })));
  const trend = await studentNetTrend(centerId, studentId, analysis.exam.kind, 10, options.publishedOnly);
  return { analysis, result, sections, weakTopics, trend };
}

export async function studentNetTrend(centerId: string, studentId: string, kind: ExamKindName, limit = 10, publishedOnly = false) {
  const exams = await db.centerExam.findMany({
    where: { centerId, kind, results: { some: { studentId } }, ...(publishedOnly ? { isPublished: true } : {}) },
    orderBy: { date: "desc" },
    take: limit,
    select: { id: true, name: true, date: true, results: { select: { studentId: true, net: true } } },
  });
  return exams
    .reverse()
    .map((e) => ({
      examId: e.id,
      name: e.name,
      date: e.date,
      net: e.results.find((r) => r.studentId === studentId)?.net ?? 0,
      average: e.results.length ? round2(e.results.reduce((t, r) => t + r.net, 0) / e.results.length) : 0,
    }));
}

/** Öğrencinin tüm denemelerdeki konu başarısı: en zayıf konular "eksikler" olarak gösterilir. */
export async function studentWeakTopics(centerId: string, studentId: string, options: { publishedOnly?: boolean } = {}) {
  const results = await db.centerExamSectionResult.findMany({
    where: { answers: { not: null }, result: { studentId, exam: { centerId, ...(options.publishedOnly ? { isPublished: true } : {}) } } },
    include: { section: { include: { exam: { select: { kind: true } } } } },
    orderBy: { result: { createdAt: "desc" } },
    take: 60,
  });
  const merged = new Map<string, TopicStat & { sectionName: string; subjectSlug: string | null; kind: ExamKindName }>();
  for (const r of results) {
    if (!r.section.topics.length) continue;
    const outcomes = outcomesFor(r.section, r.answers);
    if (!outcomes) continue;
    for (const stat of topicBreakdown(r.section.topics, [outcomes])) {
      const key = `${normalizeSearch(r.section.name)}|${stat.topic}`;
      const prev = merged.get(key) ?? { ...stat, questions: 0, correct: 0, wrong: 0, blank: 0, rate: 0, sectionName: r.section.name, subjectSlug: r.section.subjectSlug, kind: r.section.exam.kind };
      prev.questions += stat.questions;
      prev.correct += stat.correct;
      prev.wrong += stat.wrong;
      prev.blank += stat.blank;
      merged.set(key, prev);
    }
  }
  return [...merged.values()]
    .map((s) => ({ ...s, rate: s.questions ? s.correct / s.questions : 0 }))
    .filter((s) => s.questions >= 2 && s.rate <= WEAK_TOPIC_RATE)
    .sort((a, b) => a.rate - b.rate || b.questions - a.questions)
    .slice(0, 15);
}

/** Eksik konu için pazaryerindeki ilgili öğretmen listesi. */
export function marketplaceLink(kind: ExamKindName, subjectSlug: string | null): string {
  const level = EXAM_PRESETS[kind].levelSlug;
  if (level && subjectSlug) return `/ozel-ders/${level}/${subjectSlug}`;
  if (level) return `/ozel-ders/${level}`;
  return subjectSlug ? `/ogretmenler?subject=${subjectSlug}` : "/ogretmenler";
}

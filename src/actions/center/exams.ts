"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { EXAM_PRESETS, PENALTY_OPTIONS, type ExamKindName } from "@/lib/center/exams";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import {
  createExam,
  deleteExam,
  deleteOpticTemplate,
  importExamResults,
  importOpticResults,
  saveOpticTemplate,
  publishExam,
  saveAnswerKey,
  saveResultsGrid,
  saveStudentAnswers,
  updateExamMeta,
  type GridRow,
} from "@/server/center/exams";
import { bool, date, guard, int, list, opt, requiredText, str } from "@/server/center/form";
import { parseSectionPositions } from "@/lib/center/optic";
import { readSpreadsheet } from "@/server/center/spreadsheet";

function penaltyFrom(formData: FormData): number | null {
  const value = str(formData, "penalty");
  return PENALTY_OPTIONS.find((p) => p.value === value)?.penalty ?? null;
}

export async function createExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  const kind = str(formData, "kind") as ExamKindName;
  if (!(kind in EXAM_PRESETS)) return failure("Sınav türünü seçin.", { kind: "Tür seçin." });
  let examId = "";
  const result = await guard(async () => {
    const names = formData.getAll("sectionName").map((v) => String(v).trim());
    const counts = formData.getAll("sectionCount").map((v) => Number(v));
    const slugs = formData.getAll("sectionSubject").map((v) => String(v).trim());
    const sections = names
      .map((name, i) => ({ name: name.slice(0, 60), questionCount: Math.round(counts[i] || 0), subjectSlug: slugs[i] || null }))
      .filter((s) => s.name && s.questionCount > 0);
    const exam = await createExam(auth.ctx, {
      name: requiredText(formData, "name", "Deneme adı", 2, 120),
      kind,
      date: date(formData, "date", "Sınav tarihi"),
      publisher: opt(formData, "publisher", 80),
      wrongPenalty: penaltyFrom(formData),
      sections,
    });
    examId = exam.id;
    await centerAudit(auth.ctx, "exam.create", "CenterExam", exam.id);
    return success();
  });
  if (!result.ok) return result;
  redirect(`/kurum/denemeler/${examId}/sonuclar?durum=deneme-olustu`);
}

export async function updateExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const penalty = penaltyFrom(formData);
    if (penalty === null) throw new CenterError("Yanlış götürme kuralını seçin.");
    await updateExamMeta(auth.ctx, str(formData, "examId"), {
      name: requiredText(formData, "name", "Deneme adı", 2, 120),
      date: date(formData, "date", "Sınav tarihi"),
      publisher: opt(formData, "publisher", 80),
      wrongPenalty: penalty,
    });
    refresh();
    return success("Deneme bilgileri güncellendi; netler yeniden hesaplandı.");
  });
}

export async function deleteExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  const examId = str(formData, "examId");
  const result = await guard(async () => {
    await deleteExam(auth.ctx, examId);
    await centerAudit(auth.ctx, "exam.delete", "CenterExam", examId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/kurum/denemeler?durum=deneme-silindi");
}

export async function saveAnswerKeyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const examId = str(formData, "examId");
    for (const sectionId of list(formData, "sectionIds")) {
      await saveAnswerKey(auth.ctx, examId, sectionId, str(formData, `key:${sectionId}`, 400), str(formData, `topics:${sectionId}`, 8000));
    }
    refresh();
    return success("Cevap anahtarı ve konu dağılımı kaydedildi. Cevabı girilmiş sonuçlar yeniden okundu.");
  });
}

const count = (formData: FormData, key: string) => {
  const raw = str(formData, key);
  return raw === "" ? null : Math.round(Number(raw.replace(",", ".")));
};

/** Sonuç tablosu: her öğrenci için ders başına D ve Y; tamamen boş satır kaydedilmez. */
export async function saveResultsGridAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const sectionIds = list(formData, "sectionIds");
    const rows: GridRow[] = [];
    for (const studentId of list(formData, "studentIds")) {
      const sections = sectionIds
        .map((sectionId) => ({ sectionId, correct: count(formData, `d:${studentId}:${sectionId}`), wrong: count(formData, `y:${studentId}:${sectionId}`) }))
        .filter((s) => s.correct !== null || s.wrong !== null)
        .map((s) => ({ sectionId: s.sectionId, correct: s.correct ?? 0, wrong: s.wrong ?? 0 }));
      if (sections.some((s) => !Number.isFinite(s.correct) || !Number.isFinite(s.wrong))) throw new CenterError("Doğru ve yanlış sayıları rakam olmalı.");
      const rawScore = str(formData, `puan:${studentId}`);
      const score = rawScore ? Number(rawScore.replace(",", ".")) : null;
      if (bool(formData, `clear:${studentId}`)) rows.push({ studentId, sections: [], clear: true });
      else if (sections.length) rows.push({ studentId, sections, score: score !== null && Number.isFinite(score) ? score : null });
    }
    if (!rows.length) throw new CenterError("Kaydedilecek sonuç yok; en az bir öğrencinin doğru/yanlış sayısını girin.");
    const { saved, cleared } = await saveResultsGrid(auth.ctx, str(formData, "examId"), rows);
    refresh();
    return success(`${saved} öğrencinin sonucu kaydedildi${cleared ? `, ${cleared} sonuç silindi` : ""}. Sıralama güncellendi.`);
  });
}

export async function saveStudentAnswersAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const answers = list(formData, "sectionIds").map((sectionId) => ({ sectionId, answers: str(formData, `answers:${sectionId}`, 400) }));
    const rawScore = str(formData, "score");
    await saveStudentAnswers(auth.ctx, str(formData, "examId"), str(formData, "studentId"), answers, rawScore ? Number(rawScore.replace(",", ".")) || null : null);
    refresh();
    return success("Cevaplar okundu; doğru, yanlış ve konu analizi güncellendi.");
  });
}

export async function importExamResultsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const table = await readSpreadsheet(formData.get("file") as File);
    const summary = await importExamResults(auth.ctx, str(formData, "examId"), table);
    refresh();
    const notes = summary.problems.slice(0, 30).map((p) => `${p.row}. satır: ${p.message}`);
    return success(`${summary.saved} öğrencinin sonucu aktarıldı.`, { notes: notes.join("\n") });
  });
}

export async function publishExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const publish = str(formData, "publish") === "1";
    const notified = await publishExam(auth.ctx, str(formData, "examId"), publish, { whatsapp: bool(formData, "whatsapp") });
    refresh();
    return success(publish ? `Sonuçlar veli portalında yayında.${notified ? ` ${notified} öğrencinin velisine bildirim gönderildi.` : ""}` : "Sonuçlar veli portalından kaldırıldı.");
  });
}

export async function saveOpticTemplateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    let sections: { start: number; length: number }[];
    try {
      sections = parseSectionPositions(str(formData, "sections", 2000));
    } catch (error) {
      throw new CenterError((error as Error).message, { sections: "Örn: 40:20, 60:20" });
    }
    const nameStart = int(formData, "nameStart", 0, 0, 2000);
    const nameLength = int(formData, "nameLength", 0, 0, 200);
    await saveOpticTemplate(auth.ctx, opt(formData, "templateId"), {
      name: requiredText(formData, "name", "Şablon adı", 2, 80),
      numberStart: int(formData, "numberStart", 1, 1, 2000),
      numberLength: int(formData, "numberLength", 1, 1, 30),
      nameStart: nameStart || null,
      nameLength: nameStart ? nameLength || null : null,
      sections,
    });
    refresh();
    return success("Optik şablon kaydedildi.");
  });
}

export async function deleteOpticTemplateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteOpticTemplate(auth.ctx, str(formData, "templateId"));
    refresh();
    return success("Şablon silindi.");
  });
}

/** Optik okuyucu çıktısını (TXT/DAT) şablona göre okur. Türkçe karakterler için önce UTF-8, olmazsa Windows-1254 denenir. */
export async function importOpticAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new CenterError("Optik okuyucu dosyasını seçin.", { file: "Dosya gerekli." });
    if (file.size > 5 * 1024 * 1024) throw new CenterError("Dosya en fazla 5 MB olabilir.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("�")) text = new TextDecoder("windows-1254").decode(bytes);
    const summary = await importOpticResults(auth.ctx, str(formData, "examId"), str(formData, "templateId"), text);
    refresh();
    const notes = summary.problems.slice(0, 30).map((p) => `${p.row}. satır: ${p.message}`);
    return success(`${summary.saved} öğrencinin optik formu okundu.`, { notes: notes.join("\n") });
  });
}
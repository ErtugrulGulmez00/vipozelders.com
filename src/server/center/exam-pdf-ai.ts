import "server-only";
import { AI_SYSTEM, aiPrompt, buildExams, chunkPages, codeNames, pageText, parseAiResponse, type AiExam, type KnownStudent } from "@/lib/center/exam-pdf-ai";
import type { PdfExam, PdfItem } from "@/lib/center/exam-pdf";
import { aiConfigured, aiText } from "../ai";

// Tanınmayan sonuç PDF'ini yapay zekâyla okuma (OpenRouter). Kurumdaki öğrenci adları kodlanarak gönderilir.
// Gizlilik kilidi: gerçek öğrenci verisi yalnızca veriyi eğitimde kullanmayan sağlayıcılara gider
// (OPENROUTER_DENY_TRAINING=1). Ücretsiz modellerle deneme EXAM_PDF_AI_ALLOW_FREE=1 ile (yalnızca sahte adlarla test).

const MAX_PAGES = 120;
const PARALLEL = 2;

export function examPdfAiEnabled(): boolean {
  if (!aiConfigured()) return false;
  if (process.env.OPENROUTER_DENY_TRAINING === "1") return true;
  // Ücretsiz modeller veriyi eğitimde kullanır: yalnızca açıkça izin verilince (yerel deneme ya da sahte adlarla test).
  // Gerçek öğrenci verisine geçmeden önce bu kaldırılır, OPENROUTER_DENY_TRAINING=1 ve ücretli model kullanılır.
  return process.env.EXAM_PDF_AI_ALLOW_FREE === "1";
}

function pdfModels(): string[] | undefined {
  const list = (process.env.OPENROUTER_PDF_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

async function readPart(text: string, index: number, total: number): Promise<AiExam[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await aiText({ system: AI_SYSTEM, prompt: aiPrompt(text, { index, total }), maxTokens: 12_000, timeoutMs: 120_000, modelList: pdfModels() });
    const parsed = raw ? parseAiResponse(raw) : null;
    if (parsed) return parsed;
  }
  return null;
}

export type AiReadResult = { exams: PdfExam[]; failedParts: number; totalParts: number };

export async function readExamPdfWithAi(pages: PdfItem[][], students: KnownStudent[]): Promise<AiReadResult> {
  const texts = pages.slice(0, MAX_PAGES).map(pageText);
  const codes = new Map<string, string>();
  const coded = texts.map((t) => codeNames(t, students, codes).text);
  const chunks = chunkPages(coded);
  const results: (AiExam[] | null)[] = new Array(chunks.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, chunks.length) }, async () => {
      while (next < chunks.length) {
        const i = next++;
        results[i] = await readPart(chunks[i], i + 1, chunks.length);
      }
    }),
  );
  const ok = results.filter((r): r is AiExam[] => Boolean(r));
  const failedParts = chunks.length - ok.length;
  const exams = buildExams(ok, codes);
  const notes: string[] = [];
  if (failedParts) notes.push(`PDF'in ${chunks.length} bölümünden ${failedParts} tanesi okunamadı; o bölümdeki öğrenciler listede yok.`);
  if (pages.length > MAX_PAGES) notes.push(`PDF'in yalnızca ilk ${MAX_PAGES} sayfası okundu.`);
  for (const exam of exams) if (notes.length) exam.notes = notes;
  return { exams, failedParts, totalParts: chunks.length };
}

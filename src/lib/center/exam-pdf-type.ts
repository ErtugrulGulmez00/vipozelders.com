import type { PdfExam } from "./exam-pdf";
import { EXAM_PRESETS, type ExamKindName } from "./exams";

// PDF yüklerken kurumun seçtiği deneme türü: yapay zekâya beklenen ders yapısı söylenir, okunan yapı tutmazsa uyarılır.

export const PDF_EXAM_TYPES = [
  { value: "TYT", label: "TYT", kinds: ["TYT"] },
  { value: "AYT", label: "AYT (Sayısal, Eşit Ağırlık, Sözel)", kinds: ["AYT_SAY", "AYT_EA", "AYT_SOZ"] },
  { value: "LGS", label: "LGS", kinds: ["LGS"] },
  { value: "KPSS", label: "KPSS (Genel Yetenek - Genel Kültür)", kinds: ["KPSS"] },
  { value: "YDT", label: "YDT (Yabancı Dil)", kinds: ["YDT"] },
  { value: "OTHER", label: "Diğer (okul / ara sınıf denemesi)", kinds: [] },
] as const satisfies readonly { value: string; label: string; kinds: readonly ExamKindName[] }[];

export type PdfExamType = (typeof PDF_EXAM_TYPES)[number]["value"];

export function parsePdfExamType(value: unknown): PdfExamType | null {
  return PDF_EXAM_TYPES.find((t) => t.value === value)?.value ?? null;
}

const kindsOf = (type: PdfExamType): readonly ExamKindName[] => PDF_EXAM_TYPES.find((t) => t.value === type)?.kinds ?? [];

/** Yapay zekâya söylenecek beklenen yapı: "TYT: Türkçe 40, Sosyal Bilimler 20, ..." */
export function expectedStructure(type: PdfExamType): string | null {
  const kinds = kindsOf(type);
  if (!kinds.length) return null;
  return kinds.map((k) => `${EXAM_PRESETS[k].label}: ${EXAM_PRESETS[k].sections.map((s) => `${s.name} ${s.questionCount}`).join(", ")}`).join(" ya da ");
}

/**
 * Seçilen türü okunan denemeye uygular: ders soru sayıları şablona uyuyorsa tür atanır (ör. 5-7. sınıf adı yüzünden "Diğer"
 * kalmış LGS), uymuyorsa uyarı notu eklenir; kurum aktarmadan önce görür.
 */
export function applyExamType(exam: PdfExam, type: PdfExamType | null): PdfExam {
  if (!type) return exam;
  const kinds = kindsOf(type);
  if (!kinds.length) return exam;
  if (kinds.includes(exam.kind)) return exam;
  const counts = exam.sections.map((s) => s.questionCount);
  const fit = kinds.find((k) => {
    const preset = EXAM_PRESETS[k].sections;
    return preset.length === counts.length && preset.every((s, i) => s.questionCount === counts[i]);
  });
  if (fit) {
    const preset = EXAM_PRESETS[fit];
    return {
      ...exam,
      kind: fit,
      sections: exam.sections.map((s, i) => ({ ...s, name: preset.sections[i].name, subjectSlug: preset.sections[i].subjectSlug ?? s.subjectSlug })),
    };
  }
  const label = PDF_EXAM_TYPES.find((t) => t.value === type)?.label ?? type;
  const read = exam.sections.map((s) => `${s.name} ${s.questionCount}`).join(", ");
  const note =
    exam.kind !== "CUSTOM"
      ? `Siz ${label} seçtiniz ama PDF ${EXAM_PRESETS[exam.kind].label} denemesine benziyor (${read}). Doğru PDF'i yüklediğinizden emin olun.`
      : `Siz ${label} seçtiniz ama PDF'teki dersler bu yapıyla tutmuyor (${read}). Deneme "Diğer" olarak aktarılır; netleri PDF ile karşılaştırın.`;
  return { ...exam, notes: [...(exam.notes ?? []), note] };
}

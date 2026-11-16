import type { PdfExam } from "./exam-pdf";
import { detectKind } from "./exam-pdf";

// Bazı yayınevleri (ör. Apotemi) alt dersleri ve toplamlarını yan yana yazar: Tarih-1, Coğrafya-1, Felsefe, Din,
// Felsefe (Seçmeli) + "TYT Sosyal"; Matematik-1, Geometri + "TYT Matematik"… Toplam sütunu ayrı ders sayılırsa netler iki
// kez toplanır ve deneme türü tanınmaz. Burada toplam sütunları bulunur ve atılır; alt dersler kalır, tür toplamlara göre
// belirlenir. Seçmeli (alternatif) derste hiç soru işaretlemeyen öğrencinin o dersi "girmedi" sayılır.

const close = (a: number, b: number) => Math.abs(a - b) < 0.02;

export function collapseAggregateSections(exam: PdfExam): PdfExam {
  const counts = exam.sections.map((s) => s.questionCount);
  const aggregates = new Set<number>();
  const children = new Map<number, number[]>();
  const used = new Set<number>();
  for (let i = 0; i < counts.length; i++) {
    // Hemen öndeki, bundan küçük ve henüz bir gruba girmemiş dersler
    const before: number[] = [];
    for (let j = i - 1; j >= 0 && counts[j] < counts[i] && !used.has(j) && !aggregates.has(j); j--) before.unshift(j);
    // Öğrencilerin çoğunda toplam sütununun neti, alt derslerin netleri toplamına eşit olmalı. Hemen öndeki en kısa uygun
    // dizi alınır (AYT'de Matematik 40'ın önünde Sosyal derslerin de olduğu durumda yalnızca Matematik-2 + Geometri).
    const fitsRun = (run: number[]) => {
      let checked = 0;
      let fits = 0;
      for (const st of exam.students) {
        const agg = st.sections[i];
        if (!agg) continue;
        checked++;
        const parts = run.reduce((t, j) => t + (st.sections[j]?.net ?? 0), 0);
        if (close(agg.net, parts)) fits++;
      }
      return checked > 0 && fits / checked >= 0.7;
    };
    let run: number[] = [];
    for (let k = 2; k <= before.length; k++) {
      const candidate = before.slice(before.length - k);
      if (candidate.reduce((t, j) => t + counts[j], 0) < counts[i]) continue;
      if (fitsRun(candidate)) {
        run = candidate;
        break;
      }
    }
    if (run.length < 2) continue;
    aggregates.add(i);
    children.set(i, run);
    run.forEach((j) => used.add(j));
  }
  if (!aggregates.size) return exam;

  // Tür: toplamlar ve gruba girmeyen dersler sırasıyla bir şablona uyuyor mu (ör. 40-20-40-20 → TYT)
  const collapsedCounts = counts.flatMap((c, i) => (aggregates.has(i) ? [c] : used.has(i) ? [] : [c]));
  const keep = exam.sections.map((_, i) => !aggregates.has(i));
  // Seçmeli: bir grupta toplam soru sayısını aşan dersler varsa, hiç işaretlenmeyen alternatif ders "girmedi" olur
  const optional = new Set<number>();
  for (const [i, run] of children) if (run.reduce((t, j) => t + counts[j], 0) > counts[i]) run.forEach((j) => optional.add(j));
  // Seçmeli ders adıyla belli olan (ör. "Felsefe (Seçmeli)") tür hesabına katılmaz
  const namedOptional = (i: number) => /SEÇMEL|\(SEÇ\)/i.test(exam.sections[i].name.toLocaleUpperCase("tr-TR"));
  let kind = exam.kind === "CUSTOM" ? detectKind(exam.name, collapsedCounts) : exam.kind;
  // AYT'nin toplamları (Edebiyat-Sosyal-1 40, Sosyal-2 46…) şablon değil; alt derslerden bakılır
  if (kind === "CUSTOM") kind = detectKind(exam.name, counts.filter((_, i) => keep[i] && !namedOptional(i)));

  return {
    ...exam,
    kind,
    sections: exam.sections.filter((_, i) => keep[i]),
    students: exam.students.map((st) => ({
      ...st,
      sections: st.sections.flatMap((s, i) => {
        if (!keep[i]) return [];
        if (s && optional.has(i) && s.correct === 0 && s.wrong === 0) return [null];
        return [s];
      }),
    })),
    notes: [...(exam.notes ?? []), "Yayınevinin toplam sütunları (ör. TYT Sosyal, TYT Matematik) ayrı ders sayılmadı; alt dersler aktarılır."],
  };
}

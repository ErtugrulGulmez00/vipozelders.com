import { describe, expect, it } from "vitest";
import type { PdfExam } from "@/lib/center/exam-pdf";
import { collapseAggregateSections } from "@/lib/center/exam-pdf-aggregate";

// Apotemi biçimi: alt dersler + toplam sütunları (TYT Sosyal 20, TYT Matematik 40, TYT Fen 20)
const sec = (name: string, questionCount: number) => ({ label: name, name, questionCount, answerKey: null, topics: [], subjectSlug: null });
const r = (correct: number, wrong: number) => ({ correct, wrong, net: correct - wrong / 4, answers: null });

const exam: PdfExam = {
  name: "APOTEMİ TYT TG 1",
  institution: "",
  kind: "CUSTOM",
  wrongPenalty: 0.25,
  sections: [
    sec("Türkçe", 40), sec("Tarih-1", 5), sec("Coğrafya-1", 5), sec("Felsefe", 5), sec("Din Kül. ve Ahl. Bil.", 5), sec("Felsefe (Seçmeli)", 5), sec("TYT Sosyal", 20),
    sec("Matematik-1", 30), sec("Geometri", 10), sec("TYT Matematik", 40), sec("Fizik", 7), sec("Kimya", 7), sec("Biyoloji", 6), sec("TYT Fen", 20),
  ],
  students: [
    {
      name: "A",
      number: "1",
      className: "",
      score: 351.8,
      ranks: [],
      sections: [r(32, 8), r(4, 1), r(2, 3), r(4, 1), r(4, 1), r(0, 0), r(14, 6), r(14, 2), r(3, 1), r(17, 3), r(5, 2), r(4, 3), r(4, 2), r(13, 7)],
    },
    {
      name: "B",
      number: "2",
      className: "",
      score: 300,
      ranks: [],
      // Din yerine seçmeli felsefe
      sections: [r(30, 4), r(3, 0), r(3, 0), r(2, 1), r(0, 0), r(4, 0), r(12, 1), r(10, 5), r(5, 0), r(15, 5), r(3, 1), r(3, 1), r(2, 2), r(8, 4)],
    },
  ],
};

describe("collapseAggregateSections", () => {
  const out = collapseAggregateSections(exam);

  it("toplam sütunlarını atar, türü TYT olarak bulur", () => {
    expect(out.kind).toBe("TYT");
    expect(out.sections.map((s) => s.name)).toEqual(["Türkçe", "Tarih-1", "Coğrafya-1", "Felsefe", "Din Kül. ve Ahl. Bil.", "Felsefe (Seçmeli)", "Matematik-1", "Geometri", "Fizik", "Kimya", "Biyoloji"]);
  });

  it("toplam net iki kez sayılmaz; seçmeli derste işaretleme yoksa girmedi", () => {
    const total = (i: number) => out.students[i].sections.reduce((t, s) => t + (s?.net ?? 0), 0);
    expect(total(0)).toBe(70);
    expect(out.students[0].sections[5]).toBeNull();
    expect(out.students[1].sections[4]).toBeNull();
    expect(out.students[1].sections[5]?.correct).toBe(4);
  });

  it("toplam sütunu olmayan denemeye dokunmaz", () => {
    const plain: PdfExam = { ...exam, sections: exam.sections.slice(0, 2), students: exam.students.map((s) => ({ ...s, sections: s.sections.slice(0, 2) })) };
    expect(collapseAggregateSections(plain)).toBe(plain);
  });
});

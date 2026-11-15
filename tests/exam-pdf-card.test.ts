import { describe, expect, it } from "vitest";
import type { PdfExam } from "@/lib/center/exam-pdf";
import { buildStudentCards } from "@/lib/center/exam-pdf-card";

const exam: PdfExam = {
  name: "Deneme 1",
  institution: "",
  kind: "CUSTOM",
  wrongPenalty: 0.25,
  sections: [
    { label: "MAT", name: "Matematik", questionCount: 4, answerKey: "ABCD", topics: ["Üslü", "Üslü", "Kök", "Kök"], subjectSlug: null },
    { label: "TR", name: "Türkçe", questionCount: 2, answerKey: null, topics: [], subjectSlug: null },
  ],
  students: [
    { name: "Ali", number: "1", className: "8A", score: 400, ranks: [{ label: "İl", rank: 12, of: 900 }], sections: [{ correct: 2, wrong: 1, net: 1.75, answers: "ABD-" }, { correct: 2, wrong: 0, net: 2, answers: null }] },
    { name: "Ayşe", number: "2", className: "8A", score: null, ranks: [], sections: [{ correct: 4, wrong: 0, net: 4, answers: "ABCD" }, null] },
  ],
};

describe("buildStudentCards", () => {
  const [ali, ayse] = buildStudentCards(exam);

  it("toplam net, PDF içi sıra ve ortalama", () => {
    expect(ali.totalNet).toBe(3.75);
    expect(ayse.totalNet).toBe(4);
    expect(ayse.rank).toBe(1);
    expect(ali.rank).toBe(2);
    expect(ali.of).toBe(2);
    expect(ali.avgTotalNet).toBe(3.88);
  });

  it("ders satırları: boş sayısı ve girilmeyen ders atlanır", () => {
    expect(ali.sections).toHaveLength(2);
    expect(ali.sections[0]).toMatchObject({ name: "Matematik", correct: 2, wrong: 1, blank: 1, net: 1.75, avgNet: 2.88 });
    expect(ayse.sections.map((s) => s.name)).toEqual(["Matematik"]);
  });

  it("eksik konular cevap anahtarı ve kazanımdan çıkar", () => {
    expect(ali.weakTopics).toEqual([{ section: "Matematik", topic: "Kök", questions: 2, correct: 0, wrong: 1, blank: 1 }]);
    expect(ayse.weakTopics).toEqual([]);
    // Konu haritası tüm konuları içerir; hedef: 1 yanlış × 1,25 + 1 boş
    expect(ali.topics.map((t) => [t.topic, t.correct])).toEqual([
      ["Kök", 0],
      ["Üslü", 2],
    ]);
    expect(ali.potentialNet).toBe(2.25);
    expect(ali.ranks[0]).toEqual({ label: "İl", rank: 12, of: 900 });
  });
});

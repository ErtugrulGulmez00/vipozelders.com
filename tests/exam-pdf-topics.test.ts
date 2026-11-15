import { describe, expect, it } from "vitest";
import { answersFromTopics } from "@/lib/center/exam-pdf";
import { gradeAnswers } from "@/lib/center/exams";

describe("answersFromTopics (başka kitapçıktaki öğrenci)", () => {
  const section = { answerKey: "ABCDE", topics: ["Üslü", "Kök", "Üslü", "Kök", "Kök"], questionCount: 5 };

  it("konu tablosundaki doğru/yanlışla tutarlı cevap dizisi kurar", () => {
    const answers = answersFromTopics(section, { topics: [{ name: "Üslü", d: 1, y: 1 }, { name: "Kök", d: 2, y: 0 }], correct: 3, wrong: 1 });
    expect(answers).not.toBeNull();
    const g = gradeAnswers(section.answerKey, answers!);
    expect([g.correct, g.wrong, g.blank]).toEqual([3, 1, 1]);
    // Üslü: 1. soru doğru, 3. soru yanlış
    expect(g.outcomes[0]).toBe("C");
    expect(g.outcomes[2]).toBe("W");
  });

  it("tutmayan tabloda (toplamlar ya da konu adları) null döner", () => {
    expect(answersFromTopics(section, { topics: [{ name: "Üslü", d: 1, y: 0 }], correct: 3, wrong: 0 })).toBeNull();
    expect(answersFromTopics(section, { topics: [{ name: "Olasılık", d: 1, y: 0 }], correct: 1, wrong: 0 })).toBeNull();
    expect(answersFromTopics({ ...section, answerKey: null }, { topics: [{ name: "Üslü", d: 1, y: 0 }], correct: 1, wrong: 0 })).toBeNull();
  });
});

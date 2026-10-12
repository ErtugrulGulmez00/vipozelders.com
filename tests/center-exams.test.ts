import { describe, expect, it } from "vitest";
import {
  AnswerFormatError,
  competitionRanks,
  computeNet,
  EXAM_PRESETS,
  gradeAnswers,
  normalizeAnswers,
  parseTopics,
  topicBreakdown,
  topicsToText,
} from "@/lib/center/exams";

describe("deneme şablonları", () => {
  it("LGS 90, TYT 120, AYT sayısal 80 soru", () => {
    const total = (kind: keyof typeof EXAM_PRESETS) => EXAM_PRESETS[kind].sections.reduce((n, s) => n + s.questionCount, 0);
    expect(total("LGS")).toBe(90);
    expect(total("TYT")).toBe(120);
    expect(total("AYT_SAY")).toBe(80);
    expect(total("AYT_EA")).toBe(80);
    expect(total("AYT_SOZ")).toBe(80);
    expect(total("YDT")).toBe(80);
  });
});

describe("net hesabı", () => {
  it("LGS'de 3 yanlış 1 doğruyu götürür", () => {
    expect(computeNet(18, 3, EXAM_PRESETS.LGS.wrongPenalty)).toBe(17);
    expect(computeNet(15, 4, EXAM_PRESETS.LGS.wrongPenalty)).toBe(13.67);
  });
  it("YKS'de 4 yanlış 1 doğruyu götürür", () => {
    expect(computeNet(30, 8, 0.25)).toBe(28);
    expect(computeNet(30, 5, 0.25)).toBe(28.75);
  });
  it("götürmeyen sınavda net doğru sayısıdır", () => {
    expect(computeNet(12, 7, 0)).toBe(12);
  });
});

describe("cevap okuma", () => {
  it("ayırıcıları atar, boşları - yapar", () => {
    expect(normalizeAnswers("a b, c d.e")).toBe("ABCD-E");
    expect(normalizeAnswers("AB*C_0")).toBe("AB-C--");
  });
  it("geçersiz harfte hata verir; anahtarda X iptal demektir", () => {
    expect(() => normalizeAnswers("ABF")).toThrow(AnswerFormatError);
    expect(() => normalizeAnswers("ABX")).toThrow(AnswerFormatError);
    expect(normalizeAnswers("abx", { allowCancelled: true })).toBe("ABX");
  });
  it("doğru, yanlış ve boşları sayar; iptal soru herkese doğru", () => {
    const result = gradeAnswers("ABCDX", "ABD-");
    expect(result).toEqual({ correct: 3, wrong: 1, blank: 1, outcomes: ["C", "C", "W", "B", "C"] });
  });
  it("anahtardan uzun cevap hatadır", () => {
    expect(() => gradeAnswers("ABC", "ABCD")).toThrow(AnswerFormatError);
  });
});

describe("konu dağılımı", () => {
  it("aralıkları ve virgüllü listeleri okur", () => {
    const { topics, errors } = parseTopics("1-3: Üslü sayılar\n4 Kareköklü ifadeler\n5, 7: Olasılık\n6) 2. dereceden denklemler", 8);
    expect(errors).toEqual([]);
    expect(topics).toEqual(["Üslü sayılar", "Üslü sayılar", "Üslü sayılar", "Kareköklü ifadeler", "Olasılık", "2. dereceden denklemler", "Olasılık", ""]);
  });
  it("aralık dışını raporlar", () => {
    expect(parseTopics("9-12: Fazla", 10).errors).toHaveLength(1);
    expect(parseTopics("konu yok", 10).errors).toHaveLength(1);
  });
  it("metne geri çevirir", () => {
    expect(topicsToText(["A", "A", "B", "", "C"])).toBe("1-2: A\n3: B\n5: C");
  });
  it("konu bazında başarı oranı; en zayıf konu başta", () => {
    const stats = topicBreakdown(["Üslü", "Üslü", "Olasılık"], [["C", "W", "B"], ["C", "C", "W"]]);
    expect(stats[0]).toMatchObject({ topic: "Olasılık", questions: 1, correct: 0, wrong: 1, blank: 1, rate: 0 });
    expect(stats[1]).toMatchObject({ topic: "Üslü", questions: 2, correct: 3, wrong: 1, rate: 0.75 });
  });
});

describe("sıralama", () => {
  it("eşit netler aynı sırayı paylaşır", () => {
    expect(competitionRanks([50, 72.5, 50, 80])).toEqual([3, 2, 3, 1]);
  });
});

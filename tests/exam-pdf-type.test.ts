import { describe, expect, it } from "vitest";
import type { PdfExam } from "@/lib/center/exam-pdf";
import { buildExams, parseAiResponse } from "@/lib/center/exam-pdf-ai";
import { applyExamType, expectedStructure, parsePdfExamType } from "@/lib/center/exam-pdf-type";

const sec = (name: string, questionCount: number) => ({ label: name, name, questionCount, answerKey: null, topics: [], subjectSlug: null });
const base = (kind: PdfExam["kind"], counts: number[]): PdfExam => ({
  name: "Deneme",
  institution: "",
  kind,
  wrongPenalty: 0.25,
  sections: counts.map((c, i) => sec(`Ders ${i + 1}`, c)),
  students: [],
});

describe("deneme türü seçimi", () => {
  it("tür değeri doğrulanır, beklenen yapı yazılır", () => {
    expect(parsePdfExamType("KPSS")).toBe("KPSS");
    expect(parsePdfExamType("xyz")).toBeNull();
    expect(expectedStructure("KPSS")).toContain("Türkçe 30, Matematik 30, Tarih 27, Coğrafya 18, Vatandaşlık 9, Güncel Bilgiler 6");
    expect(expectedStructure("OTHER")).toBeNull();
  });

  it("soru sayıları şablona uyuyorsa tür atanır ve ders adları şablondan gelir", () => {
    const out = applyExamType(base("CUSTOM", [30, 30, 27, 18, 9, 6]), "KPSS");
    expect(out.kind).toBe("KPSS");
    expect(out.sections.map((s) => s.name)).toEqual(["Türkçe", "Matematik", "Tarih", "Coğrafya", "Vatandaşlık", "Güncel Bilgiler"]);
  });

  it("tutmayan yapıda uyarı notu eklenir, tür değişmez", () => {
    const lgs = applyExamType(base("LGS", [20, 10, 10, 10, 20, 20]), "TYT");
    expect(lgs.kind).toBe("LGS");
    expect(lgs.notes?.[0]).toContain("LGS denemesine benziyor");
    const odd = applyExamType(base("CUSTOM", [15, 15]), "LGS");
    expect(odd.kind).toBe("CUSTOM");
    expect(odd.notes?.[0]).toContain("tutmuyor");
    expect(applyExamType(base("TYT", [40, 20, 40, 20]), "TYT").notes).toBeUndefined();
  });
});

describe("yapay zekâ: kazanım tablosu (konu · soru · doğru · yanlış)", () => {
  // 4 soruluk ders, anahtar ABCD; konular: "Üslü" 2 soru, "Kök" 2 soru
  const raw = JSON.stringify({
    exams: [
      {
        name: "Deneme",
        sections: [{ name: "Matematik", questionCount: 4, answerKey: "ABCD", topics: [], topicTable: [{ name: "Üslü", questionCount: 2 }, { name: "Kök", questionCount: 2 }] }],
        students: [
          // 1-2 doğru, 3-4 yanlış → Üslü 2D, Kök 2Y
          { name: "OGR1", sections: [{ correct: 2, wrong: 2, net: 1.5, answers: "ABDC", topicResults: [{ correct: 2, wrong: 0 }, { correct: 0, wrong: 2 }] }] },
          // 1 boş, 2 doğru, 3 doğru, 4 boş → Üslü 1D, Kök 1D
          { name: "OGR2", sections: [{ correct: 2, wrong: 0, net: 2, answers: "-BC-", topicResults: [{ correct: 1, wrong: 0 }, { correct: 1, wrong: 0 }] }] },
        ],
      },
    ],
  });

  it("tablo, öğrencilerin cevaplarıyla tutarlı biçimde sorulara eşlenir", () => {
    const parsed = parseAiResponse(raw);
    expect(parsed).not.toBeNull();
    const [exam] = buildExams([parsed!], new Map());
    expect(exam.sections[0].topics).toEqual(["Üslü", "Üslü", "Kök", "Kök"]);
  });
});

import { describe, expect, it } from "vitest";
import { buildExams, chunkPages, codeNames, decodeName, pageText, parseAiResponse } from "@/lib/center/exam-pdf-ai";

const students = [
  { id: "1", firstName: "Ayşe", lastName: "Yılmaz" },
  { id: "2", firstName: "Ali Can", lastName: "Öztürk" },
];

describe("yapay zekâ ile PDF okuma: saf kısım", () => {
  it("konumlu parçaları satır metnine çevirir, sütun boşluğunu işaretler", () => {
    const text = pageText([
      { x: 10, y: 700, w: 30, str: "Ad" },
      { x: 120, y: 700, w: 20, str: "Net" },
      { x: 10, y: 680, w: 40, str: "AYŞE" },
      { x: 52, y: 681, w: 40, str: "YILMAZ" },
      { x: 120, y: 680, w: 20, str: "12,5" },
    ]);
    expect(text).toBe("Ad | Net\nAYŞE YILMAZ | 12,5");
  });

  it("kurumdaki öğrencinin adını her yazımda kodlar, kod yalnızca bizde çözülür", () => {
    const { text, codes } = codeNames("1 | AYŞE YILMAZ | 8-A\n2 | öztürk ali can | 8-B\n3 | Ayse Yilmaz\n4 | Mehmet Kaya", students);
    expect(text).not.toMatch(/ayşe|yılmaz|öztürk|ali can/i);
    expect(text).toContain("Mehmet Kaya");
    const tokens = text.match(/OGR\d+/g)!;
    // "AYŞE YILMAZ" ve "Ayse Yilmaz" aynı kişi: aynı kod
    expect(tokens).toHaveLength(3);
    expect(new Set(tokens).size).toBe(2);
    expect(tokens[0]).toBe(tokens[2]);
    expect(decodeName(tokens[0], codes)).toBe("AYŞE YILMAZ");
    expect(decodeName(tokens[1], codes)).toBe("öztürk ali can");
  });

  it("iki satıra sarmış adı tablo satırına geri ekler ve kodlar", () => {
    const items = [
      { x: 10, y: 700, w: 30, str: "ARSLAN" },
      { x: 70, y: 694, w: 20, str: "1025" },
      { x: 110, y: 694, w: 20, str: "38/2/0" },
      { x: 150, y: 694, w: 20, str: "37,50" },
      { x: 10, y: 688, w: 30, str: "YAĞMUR" },
    ];
    expect(pageText(items)).toBe("ARSLAN YAĞMUR | 1025 | 38/2/0 | 37,50");
    // Ad parçaları ayrı satırlarda kalsa bile sözcük sözcük kodlanır
    const coded = codeNames("ARSLAN | 1025\nyağmur | x", [{ id: "9", firstName: "Yağmur", lastName: "Arslan" }]);
    expect(coded.text).not.toMatch(/arslan|yağmur/i);
    expect(decodeName(coded.text.match(/AD\d+/g)!.join(" "), coded.codes)).toBe("ARSLAN yağmur");
  });

  it("aynı ad iki parçada aynı kodu alır", () => {
    const codes = new Map<string, string>();
    const a = codeNames("AYŞE YILMAZ", students, codes).text;
    const b = codeNames("Ayşe Yılmaz", students, codes).text;
    expect(a).toBe("OGR1");
    expect(b).toBe("OGR1");
  });

  it("kod bloğu ve açıklama içindeki JSON'u okur, Türkçe ondalığı çevirir", () => {
    const exams = parseAiResponse('İşte sonuç:\n```json\n{"exams":[{"name":"LGS 1","sections":[{"name":"Türkçe","questionCount":20}],"students":[{"name":"OGR1","sections":[{"correct":"15","wrong":3,"net":"14,00"}]}]}]}\n```');
    expect(exams?.[0].students[0]?.sections[0]).toMatchObject({ correct: 15, wrong: 3, net: 14 });
    expect(parseAiResponse("okuyamadım")).toBeNull();
  });

  it("parçaları birleştirir, LGS şablonuna oturtur, tutarsız satırı işaretler", () => {
    const sections = [
      ["Türkçe", 20],
      ["T.C. İnkılap Tarihi ve Atatürkçülük", 10],
      ["Din Kültürü", 10],
      ["İngilizce", 10],
      ["Matematik", 20],
      ["Fen Bilimleri", 20],
    ].map(([name, questionCount]) => ({ name: name as string, questionCount: questionCount as number }));
    const row = (correct: number, wrong: number, net: number) => ({ correct, wrong, net });
    const part1 = parseAiResponse(
      JSON.stringify({ exams: [{ name: "LGS Deneme 3", sections, students: [{ name: "OGR1", number: "12", sections: [row(18, 2, 17.33), row(9, 0, 9), row(10, 0, 10), row(8, 1, 7.67), row(15, 3, 14), row(17, 3, 16)] }] }] }),
    )!;
    const part2 = parseAiResponse(
      JSON.stringify({ exams: [{ name: "LGS DENEME 3", sections, students: [{ name: "Mehmet Kaya", sections: [row(12, 6, 10), row(15, 0, 15), null, null, null, null] }] }] }),
    )!;
    const codes = new Map([["OGR1", "AYŞE YILMAZ"]]);
    const [exam] = buildExams([part1, part2], codes);
    expect(exam.kind).toBe("LGS");
    expect(exam.source).toBe("ai");
    expect(exam.wrongPenalty).toBeCloseTo(1 / 3);
    expect(exam.students.map((s) => s.name)).toEqual(["AYŞE YILMAZ", "Mehmet Kaya"]);
    expect(exam.students[0].warnings).toBeUndefined();
    // İkinci öğrenci: Türkçe neti tutmuyor (12 - 6/3 = 10 doğru), İnkılap 15 doğru 10 soruyu aşıyor
    expect(exam.students[1].warnings).toEqual([expect.stringContaining("soru sayısını")]);
  });

  it("sayfaları sınırı aşmadan parçalar, sayfayı bölmez", () => {
    const chunks = chunkPages(["a".repeat(6000), "b".repeat(6000), "c".repeat(100)], 12_000);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toContain("Sayfa 2");
  });
});

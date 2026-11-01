import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { aliasKey, matchStudents, nameSimilarity } from "@/lib/center/exam-match";
import { assignTopics, bookletShift, parseResultPdf, type PdfItem } from "@/lib/center/exam-pdf";
import type { CenterContext } from "@/server/center/context";
import { confirmPdfImport, getPdfImport } from "@/server/center/exam-pdf-import";
import { db } from "@/server/db";

afterAll(async () => {
  await db.$disconnect();
});

// Gerçek sonuç PDF'lerindeki "Sonuç Belgesi" sayfasının yerleşimini taklit eden sentetik sayfa (koordinatlar gerçek PDF'ten).
type SectionSpec = { label: string; name: string; d: number; y: number; n: string; shown: string; key: string; topics: [string, number, number, number][] };
const CW = 4.2;
const item = (x: number, y: number, str: string, w = str.length * 4) => ({ x, y, w, str });

function resultPage(opts: { exam: string; name: string; number: string; cls: string; booklet: string; score: string; ranks: number[]; sections: SectionSpec[] }): PdfItem[] {
  const items: PdfItem[] = [
    item(120, 808, "SONUÇ BELGESİ", 81),
    item(300, 810, opts.exam, 178),
    item(26, 792, "İL / İLÇE / ÖRNEK ETÜT", 176),
    item(26, 775, "Öğrenci", 31),
    item(211, 775, "Numara", 32),
    item(266, 775, "Sınıf", 17),
    item(26, 761, opts.name, opts.name.length * 5),
    item(214, 761, opts.number, 25),
    item(268, 761, opts.cls, 13),
    item(165, 731, "Snf", 10),
    item(180, 731, "Kurum", 20),
    item(210, 731, "İlçe", 10),
    item(243, 731, "İl", 3),
    item(270, 731, "Genel", 18),
    item(26, 715, "LGS", 14),
    item(78, 714, opts.score, 33),
    item(129, 715, "328,210", 25),
    ...[168, 185, 211, 241, 270].map((x, i) => item(x, 715, String(opts.ranks[i]), 9)),
    item(121, 699, "Katılımlar:", 36),
    ...[168, 185, 211, 241, 268].map((x, i) => item(x, 699, String([6, 47, 47, 62, 23197][i]), 9)),
    item(51, 679, "Ders", 16),
    item(101, 680, "Soru", 14),
    item(121, 680, "Doğru", 18),
    item(144, 680, "Yanlış", 18),
    item(173, 680, "Net", 11),
    item(26, 562, "Soru No", 28),
    item(82, 562, "123456", 6 * CW),
  ];
  let ty = 661;
  let ay = 547;
  let ry = 782;
  for (const s of opts.sections) {
    items.push(item(26, ty, s.name, 24), item(103, ty, String(s.key.length), 9), item(126, ty, String(s.d), 9), item(151, ty, String(s.y), 4), item(169, ty, s.n, 20));
    ty -= 14;
    items.push(item(26, ay, s.label, 41));
    // Cevap satırı boşluklarda bölünür; her parça kendi konumunda.
    for (const m of s.shown.matchAll(/\S+/g)) items.push(item(82 + m.index! * CW, ay, m[0], m[0].length * CW));
    items.push(item(26, ay - 11, "Cevap Anh.", 40), item(71, ay - 11, opts.booklet, 5), item(82, ay - 11, s.key, s.key.length * CW));
    ay -= 25;
    items.push(item(303, ry, s.label, 26), item(309, ry - 8, s.name, 15), item(542, ry - 8, "S", 3), item(549, ry - 8, "D", 3), item(556, ry - 8, "Y", 3), item(563, ry - 8, "B%", 7));
    ry -= 16;
    for (const [topic, sc, dc, yc] of s.topics) {
      items.push(item(309, ry, topic, 80), item(542, ry, String(sc), 3), item(549, ry, String(dc), 3), item(556, ry, String(yc), 3), item(563, ry, "50", 8));
      ry -= 7;
    }
  }
  items.push(item(63, ty, "Toplam:", 28));
  return items;
}

// Türkçe: soru 1, 2, 5 "Paragraf"; 3, 4, 6 "Sözcük". B kitapçığı A'nın 2 soru kaydırılmışı.
const KEY_A = "ABCDAB";
const KEY_B = "CDABAB";
const pages = [
  [item(100, 800, "OKUL NET LİSTESİ (LGS sıralı)")],
  resultPage({
    exam: "8.SINIF ÖRNEK TÜRKİYE GENELİ",
    name: "AHSENN",
    number: "0",
    cls: "8-XX",
    booklet: "A",
    score: "409,058",
    ranks: [1, 11, 11, 12, 3838],
    sections: [
      { label: "Sözel (TÜR)", name: "Türkçe", d: 4, y: 1, n: "3,67", shown: "AB DcB", key: KEY_A, topics: [["Paragraf", 3, 2, 1], ["Sözcük", 3, 2, 0]] },
      { label: "Sayısal (MAT)", name: "Matematik", d: 4, y: 0, n: "4,00", shown: "DCBA", key: "DCBA", topics: [["Sayılar", 4, 4, 0]] },
    ],
  }),
  resultPage({
    exam: "8.SINIF ÖRNEK TÜRKİYE GENELİ",
    name: "ABDULLAH YILDIRIMM",
    number: "1",
    cls: "8-Ğ",
    booklet: "B",
    score: "296,285",
    ranks: [5, 36, 36, 45, 14972],
    // Matematiğe girmemiş: o ders sayfada hiç yok.
    sections: [{ label: "Sözel (TÜR)", name: "Türkçe", d: 4, y: 1, n: "3,67", shown: "CDAa B", key: KEY_B, topics: [["Paragraf", 3, 2, 0], ["Sözcük", 3, 2, 1]] }],
  }),
];

describe("yayınevi sonuç PDF'i okuma", () => {
  const parsed = parseResultPdf(pages);
  const exam = parsed.exams[0];

  it("denemeyi, dersleri, anahtarı ve yanlış götürmeyi çıkarır", () => {
    expect(parsed.exams).toHaveLength(1);
    expect(parsed.skippedPages).toBe(1);
    expect(exam.name).toBe("8.SINIF ÖRNEK TÜRKİYE GENELİ");
    expect(exam.kind).toBe("CUSTOM");
    expect(exam.wrongPenalty).toBeCloseTo(1 / 3);
    expect(exam.sections.map((s) => [s.name, s.questionCount, s.answerKey, s.subjectSlug])).toEqual([
      ["Türkçe", 6, KEY_A, "turkce"],
      ["Matematik", 4, "DCBA", "matematik"],
    ]);
  });

  it("öğrenci bilgisi, puan ve sıralamalar", () => {
    const [a, b] = exam.students;
    expect(a).toMatchObject({ name: "AHSENN", number: "0", className: "8-XX", score: 409.058 });
    expect(a.ranks).toEqual([
      { label: "Sınıf", rank: 1, of: 6 },
      { label: "Kurum", rank: 11, of: 47 },
      { label: "İlçe", rank: 11, of: 47 },
      { label: "İl", rank: 12, of: 62 },
      { label: "Genel", rank: 3838, of: 23197 },
    ]);
    expect(b.name).toBe("ABDULLAH YILDIRIMM");
  });

  it("boş soruları konumdan bulur; B kitapçığını A sırasına çevirir; girilmeyen ders null", () => {
    const [a, b] = exam.students;
    expect(a.sections[0]).toEqual({ correct: 4, wrong: 1, net: 3.67, answers: "AB-DCB" });
    expect(a.sections[1]?.answers).toBe("DCBA");
    expect(b.sections[0]?.answers).toBe("-BCDAA");
    expect(b.sections[1]).toBeNull();
  });

  it("soru başına kazanımı öğrencilerin kazanım özetlerinden bulur", () => {
    expect(exam.sections[0].topics).toEqual(["Paragraf", "Paragraf", "Sözcük", "Sözcük", "Paragraf", "Sözcük"]);
    expect(exam.sections[1].topics).toEqual(["Sayılar", "Sayılar", "Sayılar", "Sayılar"]);
  });

  it("kitapçık kaydırması tek değilse kullanılmaz", () => {
    expect(bookletShift(KEY_B, KEY_A)).toBe(2);
    expect(bookletShift("AAAA", "AAAA")).toBeNull();
    expect(bookletShift("ABCD", "ABC")).toBeNull();
  });

  it("tutarsız kazanım özetinde eşleme yapılmaz", () => {
    expect(assignTopics(2, { names: ["X"], sizes: [3], students: [] })).toBeNull();
    expect(assignTopics(2, { names: ["X", "Y"], sizes: [1, 1], students: [{ outcomes: ["C", "C"], d: [0, 0], y: [0, 0] }] })).toBeNull();
  });
});

describe("PDF öğrencisini kurum öğrencisiyle eşleştirme", () => {
  const candidates = [
    { id: "ahsen", firstName: "Ahsen", lastName: "Yılmaz", studentNumber: "101", groups: ["8-A"] },
    { id: "ahmet", firstName: "Ahmet", lastName: "Yılmaz", studentNumber: "12345", groups: [] },
    { id: "eylul1", firstName: "Eylül", lastName: "Güvendik", studentNumber: null, groups: [] },
    { id: "eylul2", firstName: "Eylül", lastName: "Kaya", studentNumber: null, groups: [] },
    { id: "abdullah", firstName: "Abdullah", lastName: "Yıldırım", studentNumber: "7", groups: [] },
  ];

  it("tam ad, benzer ad, anlamsız numara ve hatırlanan eşleşme", () => {
    const inputs = [
      { name: "AHMET YILMAZ", number: "12345", className: "8-A" },
      { name: "ABDULLAH YILDIRIMM", number: "1", className: "8-Ğ" },
      { name: "EYLÜL", number: "12345", className: "8-XX" },
      { name: "AHSENN", number: "0", className: "8-XX" },
      { name: "MEHMET DEMİR", number: "101", className: "" },
    ];
    const result = matchStudents(inputs, candidates, new Map());
    expect(result.map((r) => [r.studentId, r.confidence])).toEqual([
      ["ahmet", "exact"],
      ["abdullah", "suggested"],
      [null, "none"],
      [null, "none"],
      [null, "none"],
    ]);
    // İki Eylül: kendisi seçmeli, ikisi de önerilir. Ahsen öneri olarak gelir.
    expect(result[2].suggestions.map((s) => s.id).sort()).toEqual(["eylul1", "eylul2"]);
    expect(result[3].suggestions[0].id).toBe("ahsen");

    const remembered = matchStudents(inputs, candidates, new Map([[aliasKey(inputs[2]), "eylul2"]]));
    expect(remembered[2]).toMatchObject({ studentId: "eylul2", confidence: "alias" });
  });

  it("numara ad da benzerse eşleşir; aynı öğrenci iki satıra verilmez", () => {
    const result = matchStudents(
      [
        { name: "AHSEN Y", number: "0101", className: "" },
        { name: "AHSEN YILMAZ", number: "5", className: "" },
      ],
      candidates,
      new Map(),
    );
    expect(result[1]).toMatchObject({ studentId: "ahsen", confidence: "exact" });
    expect(result[0].studentId).toBeNull();
    expect(nameSimilarity("ABDULLAH YILDIRIMM", "Abdullah Yıldırım")).toBeGreaterThan(0.9);
  });
});

describe("PDF aktarımı (veritabanı)", () => {
  it("deneme, anahtar, kazanım, sonuç ve sıralamaları kaydeder; ikinci yüklemede aynı denemeyi günceller", async () => {
    const id = randomUUID().slice(0, 8);
    const center = await db.center.create({ data: { name: `PDF Etüt ${id}`, slug: `pdf-etut-${id}`, status: "ACTIVE" } });
    const ctx = { center: { id: center.id } } as unknown as CenterContext;
    const ahsen = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ahsen", lastName: "Yılmaz" } });
    const abdullah = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Abdullah", lastName: "Yıldırım" } });
    const data = { exams: parseResultPdf(pages).exams };
    const draft = await db.centerExamImport.create({ data: { centerId: center.id, fileName: "sonuc.pdf", data } });

    const view = await getPdfImport(ctx, draft.id);
    expect(view.exams[0].matches.map((m) => m.studentId)).toEqual([null, abdullah.id]);
    expect(view.exams[0].existing).toBeNull();

    const choice = { use: true, name: "Örnek TG 1", date: "2026-10-30", publisher: "Örnek Yayın", studentIds: [ahsen.id, abdullah.id] };
    const { examIds, saved } = await confirmPdfImport(ctx, draft.id, [choice]);
    expect(saved).toBe(2);
    const exam = await db.centerExam.findUniqueOrThrow({ where: { id: examIds[0] }, include: { sections: { orderBy: { order: "asc" } }, results: { include: { sections: true } } } });
    expect(exam.sections[0]).toMatchObject({ answerKey: KEY_A, topics: ["Paragraf", "Paragraf", "Sözcük", "Sözcük", "Paragraf", "Sözcük"] });
    const own = exam.results.find((r) => r.studentId === ahsen.id)!;
    expect(own).toMatchObject({ correct: 8, wrong: 1, net: 7.67, score: 409.058, rank: 1 });
    expect(own.externalRanks).toContainEqual({ label: "Genel", rank: 3838, of: 23197 });
    expect(exam.results.find((r) => r.studentId === abdullah.id)!.sections).toHaveLength(1);
    expect(await db.centerExamImport.count({ where: { id: draft.id } })).toBe(0);

    // Aynı PDF yeniden: Ahsen artık hatırlanır, deneme aynı adla bulunur ve çiftlenmez.
    const again = await db.centerExamImport.create({ data: { centerId: center.id, fileName: "sonuc.pdf", data: { exams: data.exams.map((e) => ({ ...e, name: "Örnek TG 1" })) } } });
    const view2 = await getPdfImport(ctx, again.id);
    expect(view2.exams[0].matches.map((m) => m.confidence)).toEqual(["alias", "alias"]);
    expect(view2.exams[0].existing?.id).toBe(exam.id);
    await confirmPdfImport(ctx, again.id, [choice]);
    expect(await db.centerExam.count({ where: { centerId: center.id } })).toBe(1);
    expect(await db.centerExamResult.count({ where: { examId: exam.id } })).toBe(2);

    await expect(confirmPdfImport(ctx, (await db.centerExamImport.create({ data: { centerId: center.id, fileName: "x.pdf", data } })).id, [{ ...choice, studentIds: [ahsen.id, ahsen.id] }])).rejects.toThrow(/birden fazla satırda/);
  });
});

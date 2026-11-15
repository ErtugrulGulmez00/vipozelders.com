import { describe, expect, it } from "vitest";
import type { PdfItem } from "@/lib/center/exam-pdf";
import { parseAkbimPdf } from "@/lib/center/exam-pdf-akbim";

// Akbim ODS sonuç belgesinin sentetik benzeri (gerçek öğrenci verisi yok): TYT, Türkçe 40 / Sosyal 20 / T. Mat 40 / Fen 20.
const item = (x: number, y: number, str: string, w = str.length * 2.6): PdfItem => ({ x, y, w, str });
const spaced = (s: string) => s.split("").join(" ");

const KEY_TR = "DDAEACBDAAEEDCCCADDBCEAACBAACE" + "EDBDBCEBEB"; // 40
const COLS = ["TÜRKÇE", "SOSYAL", "T. MAT", "FEN", "MAT-1", "GEO-1"];
const COL_X = [73, 99, 125, 154, 176, 202];

function page(name: string, no: string, t: { d: number; y: number }, answers: { x: number; str: string; w: number }[], score: string, topicD: number[]): PdfItem[] {
  const items: PdfItem[] = [
    item(466, 827, "SINAV SONUÇ BELGESİ"),
    item(47, 826, "BİTLİS / AHLAT / ÖRNEK ETÜT MERKEZİ"),
    item(25, 806, "MEB KODU"), item(65, 806, "ŞUBE"), item(85, 806, "ÖĞR.NO"), item(126, 806, "TC NO"), item(217, 806, "SOYADI - ADI"), item(412, 806, "SINAV ADI"), item(550, 806, "TARİH"),
    item(25, 794, "13001301"), item(71, 794, "A"), item(87, 794, no), item(129, 794, "*****"), item(219, 794, name), item(390, 794, "ÖRNEK TYT DENEME-1"), item(542, 794, "6.11.2026"),
    item(33, 772, "DERSLER"),
    ...COLS.map((c, i) => item(COL_X[i], 773, c, c.length * 4)),
    item(22, 761, "SORU SAYISI"), ...[40, 20, 40, 20, 0, 0].map((v, i) => item(COL_X[i] + 5, 761, String(v), 8)),
    item(22, 750, "DOĞRU CEVAP"), ...[t.d, 11, 6, 0, 0, 0].map((v, i) => item(COL_X[i] + 5, 749, String(v), 8)),
    item(22, 738, "YANLIŞ CEVAP"), ...[t.y, 5, 7, 0, 0, 0].map((v, i) => item(COL_X[i] + 5, 738, String(v), 8)),
    item(22, 716, "NET"), ...[t.d - t.y / 4, 9.75, 4.25, 0, 0, 0].map((v, i) => item(COL_X[i], 715, v.toFixed(2).replace(".", ","), 14)),
    item(82, 681, "TYT"), item(22, 676, "PUANLAR"), item(76, 670, score, 22),
    item(30, 659, "TÜRKİYE"), item(87, 659, "0", 4), item(268, 659, "17.087", 20),
    item(30, 625, "KURUM"), item(87, 625, "3", 4), item(273, 625, "20", 8),
    // Türkçe cevap anahtarı (iki parça) ve öğrenci cevapları
    item(21, 604, "TÜRKÇE"),
    { x: 69, y: 603, w: 154, str: spaced(KEY_TR.slice(0, 30)) },
    { x: 226, y: 603, w: 49, str: spaced(KEY_TR.slice(30)) },
    item(21, 595, "ÖĞRENCİ CEVABI"),
    ...answers.map((a) => ({ x: a.x, y: 594, w: a.w, str: a.str })),
    // Kazanım tablosu
    item(73, 479, "KONU ADI"), item(159, 479, "SS", 6), item(171, 479, "D", 3), item(183, 479, "Y", 3), item(196, 479, "%", 3),
    item(260, 479, "KONU ADI"), item(345, 479, "SS", 6), item(357, 479, "D", 3), item(369, 479, "Y", 3),
    item(31, 471, "TÜRKÇE"),
  ];
  // Konu tablosu: 30 soruluk "PARAGRAF" + 10 soruluk "YAZIM"
  const topics = [["PARAGRAF BİLGİSİ", 30], ["YAZIM KURALLARI", 10]] as const;
  topics.forEach(([n, s], k) => {
    const y = 465 - k * 8;
    items.push(item(22, y, n), item(161, y, String(s), 6), item(172, y, String(topicD[k]), 4), item(183, y, String(k === 0 ? t.y : 0), 4));
  });
  return items;
}

// Öğrenci 1: ilk 30 soruyu doğru, son 10'u boş → 30 D, 0 Y (sıkışık yazım, tek parça)
const s1 = page("AYŞE ÖRNEK", "00012", { d: 30, y: 0 }, [{ x: 69, w: 30 * 5.2, str: KEY_TR.slice(0, 30) }], "300,500", [30, 0]);
// Öğrenci 2: 1-10 doğru (aralıklı yazım), 11-20 boş, 21-30'da 2 yanlış (küçük harf) → 28 D... aşağıda: 18 D, 2 Y
const wrong = KEY_TR.slice(20, 30).split("").map((c, i) => (i < 2 ? (c === "A" ? "b" : "a") : c)).join("");
const s2 = page("MEHMET DENEME", "00013", { d: 18, y: 2 }, [{ x: 69, w: 10 * 5.2, str: spaced(KEY_TR.slice(0, 10)) }, { x: 69 + 20 * 5.22, w: 10 * 5.2, str: wrong }], "250,250", [18, 0]);

describe("parseAkbimPdf", () => {
  const [exam] = parseAkbimPdf([s1, s2]);

  it("künye, tür, dersler ve puan", () => {
    expect(exam.name).toBe("ÖRNEK TYT DENEME-1");
    expect(exam.kind).toBe("TYT");
    expect(exam.institution).toBe("ÖRNEK ETÜT MERKEZİ");
    expect(exam.sections.map((s) => s.questionCount)).toEqual([40, 20, 40, 20]);
    expect(exam.students[0]).toMatchObject({ name: "AYŞE ÖRNEK", number: "12", className: "A", score: 300.5 });
    expect(exam.students[0].ranks).toEqual([{ label: "Kurum", rank: 3, of: 20 }]);
    expect(exam.students[1].sections[0]).toMatchObject({ correct: 18, wrong: 2, net: 17.5 });
  });

  it("cevap anahtarı ve öğrenci cevapları soru sırasına yerleşir; boşlar parçalar arasında kalır", () => {
    expect(exam.sections[0].answerKey).toBe(KEY_TR);
    expect(exam.students[0].sections[0]?.answers).toBe(KEY_TR.slice(0, 30) + "-".repeat(10));
    const a2 = exam.students[1].sections[0]?.answers ?? "";
    expect(a2.slice(0, 10)).toBe(KEY_TR.slice(0, 10));
    expect(a2.slice(10, 20)).toBe("-".repeat(10));
  });

  it("kazanım tablosu sorulara eşlenir", () => {
    const topics = exam.sections[0].topics;
    expect(topics).toHaveLength(40);
    expect(topics.filter((t) => t === "PARAGRAF BİLGİSİ")).toHaveLength(30);
    expect(topics.filter((t) => t === "YAZIM KURALLARI")).toHaveLength(10);
  });

  it("Akbim olmayan sayfa okunmaz", () => {
    expect(parseAkbimPdf([[item(10, 10, "BAŞKA BİR BELGE")]])).toEqual([]);
  });
});

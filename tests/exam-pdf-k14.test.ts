import { describe, expect, it } from "vitest";
import type { PdfItem } from "@/lib/center/exam-pdf";
import { detectKind, groupedFit, presetSectionsFor } from "@/lib/center/exam-pdf";
import { collapseAggregateSections } from "@/lib/center/exam-pdf-aggregate";
import { parseK14Karne, parseK14List } from "@/lib/center/exam-pdf-k14";
import { parseNetList } from "@/lib/center/exam-pdf-netlist";

// Sahte veriler: gerçek K14 / okul net listesi çıktılarındaki konum düzeni taklit edilir (gerçek öğrenci verisi yok).
const it_ = (str: string, x: number, y: number, w = str.length * 4): PdfItem => ({ str, x, y, w });

describe("alt derslerden deneme türü", () => {
  it("TYT alt dersleri ve AYT'nin bölünmüş matematiği tanınır; adında TYT/AYT yoksa serbest kalır", () => {
    expect(groupedFit([40, 5, 5, 5, 5, 30, 10, 7, 7, 6], [40, 20, 40, 20])).toEqual([1, 4, 2, 3]);
    expect(detectKind("4K TYT 2", [40, 5, 5, 5, 5, 40, 7, 7, 6])).toBe("TYT");
    expect(detectKind("T.G. MSÜ DENEME", [40, 5, 5, 5, 5, 30, 10, 7, 7, 6])).toBe("TYT");
    expect(detectKind("Okul denemesi", [40, 5, 5, 5, 5, 40, 7, 7, 6])).toBe("CUSTOM");
    expect(detectKind("ÇÖZÜM-7 AYT", [24, 10, 6, 11, 11, 12, 6, 40, 14, 13, 13])).toBe("AYT");
    const names = presetSectionsFor("AYT", [24, 10, 6, 11, 11, 12, 6, 30, 10, 14, 13, 13]);
    expect(names[3]?.name).toBe("Tarih-2");
    expect(names[7]).toBeNull();
    expect(names[9]?.name).toBe("Fizik");
  });

  it("AYT matematik toplamı yalnızca hemen öndeki alt derslerle eşlenir", () => {
    const sec = (name: string, questionCount: number) => ({ label: name, name, questionCount, answerKey: null, topics: [], subjectSlug: null });
    const exam = collapseAggregateSections({
      name: "DENEME AYT",
      institution: "",
      kind: "CUSTOM",
      wrongPenalty: 0.25,
      sections: [sec("Tarih-2", 11), sec("Coğrafya-2", 11), sec("Matematik-2", 30), sec("Geometri", 10), sec("Matematik", 40)],
      students: [3, 7, 12].map((n) => ({
        name: `Öğrenci ${n}`,
        number: "",
        className: "",
        score: null,
        ranks: [],
        sections: [
          { correct: 2, wrong: 0, net: 2, answers: null },
          { correct: 1, wrong: 0, net: 1, answers: null },
          { correct: n, wrong: 0, net: n, answers: null },
          { correct: 2, wrong: 0, net: 2, answers: null },
          { correct: n + 2, wrong: 0, net: n + 2, answers: null },
        ],
      })),
    });
    expect(exam.sections.map((s) => s.name)).toEqual(["Tarih-2", "Coğrafya-2", "Matematik-2", "Geometri"]);
  });
});

/** K14 analizli karne sayfası: 2 ders (Türkçe 3, Matematik 2), soru blokları iki sütunda */
function karnePage(name: string, answers: { tr: string[]; mat: string[] }, keys = { tr: ["B", "C", "D"], mat: ["A", "E"] }) {
  const items: PdfItem[] = [
    it_("DENEME TYT BİTLİS", 105, 819),
    it_("ÖRNEK KURS", 105, 804),
    it_(name, 105, 788),
    it_("DERSLER", 24, 751),
    it_("S.SAYISI", 68, 751),
    it_("DOĞRU", 91, 751),
    it_("YANLIŞ", 113, 751),
    it_("BOŞ", 138, 751),
    it_("NET", 166, 751),
    it_("Puan Türü", 313, 678),
    it_("Puanı", 371, 678),
    it_("Şube", 409, 678),
    it_("Okul", 438, 678),
    it_("Kurum Mrk", 465, 678),
    it_("Genel", 493, 678),
    it_("TYT", 312, 666),
    it_("250.5", 370, 666),
    it_("3", 417, 666),
    it_("7", 446, 666),
    it_("-", 475, 666),
    it_("-", 503, 666),
    it_("https://ornek.k14net.com", 57, 18),
  ];
  const tally = (ans: string[], key: string[]) => {
    const d = ans.filter((a, i) => a !== "-" && a.toUpperCase() === key[i] && a === a.toUpperCase()).length;
    const y = ans.filter((a, i) => a !== "-" && !(a.toUpperCase() === key[i] && a === a.toUpperCase())).length;
    return { d, y, net: d - y * 0.25 };
  };
  const tr = tally(answers.tr, keys.tr);
  const mat = tally(answers.mat, keys.mat);
  for (const [i, [label, n, t]] of ([["Türkçe", 3, tr], ["Matematik", 2, mat]] as const).entries()) {
    const y = 739 - i * 12;
    items.push(it_(label, 17, y), it_(String(n), 73, y, 6), it_(String(t.d), 95, y, 6), it_(String(t.y), 120, y, 6), it_(String(n - t.d - t.y), 143, y, 6), it_(String(t.net), 166, y, 10));
  }
  // Soru blokları: sol sütunda Türkçe, ikinci sütunda Matematik
  const block = (base: number, title: string, key: string[], ans: string[], topics: string[]) => {
    items.push(it_(title, base, 605), it_("Sr", base, 589), it_("Ö", base + 12, 589), it_("A", base + 20, 589), it_("D", base + 29, 589), it_("Kazanım Açıklama", base + 37, 589));
    key.forEach((k, q) => {
      const y = 581 - q * 8;
      items.push(it_(String(q + 1), base + 1, y, 4));
      if (ans[q] !== "-") items.push(it_(ans[q], base + 12, y, 4));
      items.push(it_(k, base + 20, y, 4), it_(topics[q], base + 37, y));
    });
  };
  block(14, "Türkçe dersi", keys.tr, answers.tr, ["Sözcükte Anlam", "Paragraf", "Paragraf"]);
  block(207, "Matematik dersi", keys.mat, answers.mat, ["Üslü Sayılar", "Problemler"]);
  return items;
}

describe("K14 analizli karne", () => {
  it("netler, puan, sıralar, cevap anahtarı, öğrenci cevapları ve soru soru kazanımlar okunur", () => {
    const pages = [karnePage("AYŞE ÖRNEK", { tr: ["B", "a", "-"], mat: ["A", "E"] }), karnePage("ALİ DENEME", { tr: ["B", "C", "D"], mat: ["-", "b"] })];
    const [exam] = parseK14Karne(pages);
    expect(exam.name).toBe("DENEME TYT BİTLİS");
    expect(exam.institution).toBe("ÖRNEK KURS");
    expect(exam.sections.map((s) => [s.name, s.questionCount, s.answerKey])).toEqual([
      ["Türkçe", 3, "BCD"],
      ["Matematik", 2, "AE"],
    ]);
    expect(exam.sections[0].topics).toEqual(["Sözcükte Anlam", "Paragraf", "Paragraf"]);
    const [ayse, ali] = exam.students;
    expect(ayse.name).toBe("AYŞE ÖRNEK");
    expect(ayse.score).toBe(250.5);
    expect(ayse.ranks).toEqual([
      { label: "Şube", rank: 3, of: null },
      { label: "Okul", rank: 7, of: null },
    ]);
    expect(ayse.sections[0]).toMatchObject({ correct: 1, wrong: 1, net: 0.75, answers: "BA-" });
    expect(ali.sections[1]).toMatchObject({ correct: 0, wrong: 1, answers: "-B" });
  });
});

describe("K14 genel sıralı liste", () => {
  it("ders başlıkları (bitişik olanlar dahil), D/Y/N sütunları, puan ve sıralar okunur", () => {
    const items: PdfItem[] = [
      it_("ÖRNEK KURS", 82, 560),
      it_("TYT Puan Türü Genel Sıralı Liste", 354, 556),
      it_("DENEME TYT BİTLİS", 82, 541),
      it_("Türkçe (40)", 268, 504),
      it_("Matemat (30) Geometr (10)", 531, 504),
      it_("Sıra", 11, 497),
      it_("Şube", 36, 497),
      it_("ADI SOYADI", 62, 497),
      it_("NET", 155, 497),
      it_("Puan", 234, 490),
    ];
    ["D", "Y", "N"].forEach((c, i) => items.push(it_(c, 266 + i * 17, 490, 4)));
    ["D", "Y", "N"].forEach((c, i) => items.push(it_(c, 532 + i * 17, 490, 4)));
    ["D", "Y", "N"].forEach((c, i) => items.push(it_(c, 585 + i * 17, 490, 4)));
    items.push(it_("Sb", 801, 490), it_("Kr", 819, 490));
    items.push(it_("1", 15, 473, 4), it_("12/A", 29, 473), it_("AYŞE ÖRNEK", 65, 473), it_("40", 153, 473, 8), it_("381.24", 232, 473, 20));
    items.push(it_("30", 264, 473, 8), it_("4", 283, 473, 4), it_("29", 298, 473, 8));
    items.push(it_("8", 532, 473, 4), it_("0", 549, 473, 4), it_("8", 566, 473, 4));
    items.push(it_("3", 586, 473, 4), it_("1", 603, 473, 4), it_("2.75", 617, 473, 14));
    items.push(it_("1", 803, 473, 4), it_("2", 821, 473, 4));
    const [exam] = parseK14List([items]);
    expect(exam.sections.map((s) => [s.name, s.questionCount])).toEqual([
      ["Türkçe", 40],
      ["Matematik", 30],
      ["Geometri", 10],
    ]);
    const [st] = exam.students;
    expect(st.name).toBe("AYŞE ÖRNEK");
    expect(st.className).toBe("12/A");
    expect(st.score).toBe(381.24);
    expect(st.sections.map((s) => s?.net)).toEqual([29, 8, 2.75]);
    expect(st.ranks.map((r) => r.rank)).toEqual([1, 2]);
  });
});

describe("okul net listesi", () => {
  it("TYT ders adlarından soru sayısı bulunur; bitişik sınıf+sayı ayrılır; ortalama satırları atlanır", () => {
    const items: PdfItem[] = [
      it_("OKUL TEST BAZLI NET LİSTESİ (TYT sıralı)", 169, 804),
      it_("OKUL", 223, 787),
      it_("SINAV ADI", 375, 787),
      it_("ÖRNEK KURS", 153, 771, 60),
      it_("DENEME TYT 2", 315, 771, 60),
      it_("TYT Türkçe", 158, 756),
      it_("TYT Sosyal", 218, 756),
      it_("TYT Matematik", 270, 756),
      it_("TYT Fen", 342, 756),
      it_("Toplam", 402, 756),
      it_("Sıra", 24, 751),
      it_("Ö.No", 42, 751),
      it_("İsim", 88, 751),
      it_("Sınıf", 131, 751),
    ];
    const cols = [154, 213, 273, 332, 392];
    for (const x of cols) ["D", "Y", "N"].forEach((c, i) => items.push(it_(c, x + i * 18, 743, 4)));
    items.push(it_("Puan", 453, 743), it_("Sn", 480, 743, 8), it_("Genel", 547, 743));
    items.push(it_("Genel Ortalama", 89, 731), it_("25,7", 150, 731, 12));
    // "12-XX36": sınıf ile Türkçe doğru sayısı bitişik
    items.push(it_("1", 29, 702, 4), it_("0", 48, 702, 4), it_("AYŞE ÖRNEK", 62, 702), it_("*", 115, 702, 3), it_("12-XX36", 133, 702, 28));
    items.push(it_("4", 171, 702, 4), it_("35,00", 186, 702, 18));
    items.push(it_("15", 212, 702, 8), it_("5", 231, 702, 4), it_("13,75", 245, 702, 18));
    items.push(it_("27", 271, 702, 8), it_("4", 290, 702, 4), it_("26,00", 305, 702, 18));
    items.push(it_("18", 331, 702, 8), it_("2", 350, 702, 4), it_("17,50", 364, 702, 18));
    items.push(it_("96", 390, 702, 8), it_("15", 407, 702, 8), it_("92,25", 424, 702, 18), it_("418,276", 448, 702, 26), it_("1", 481, 702, 4), it_("835", 554, 702, 12));
    const [exam] = parseNetList([items]);
    expect(exam.kind).toBe("TYT");
    expect(exam.name).toBe("DENEME TYT 2");
    expect(exam.sections.map((s) => s.questionCount)).toEqual([40, 20, 40, 20]);
    expect(exam.students).toHaveLength(1);
    const [st] = exam.students;
    expect(st.name).toBe("AYŞE ÖRNEK");
    expect(st.className).toBe("12-XX");
    expect(st.sections.map((s) => s && [s.correct, s.wrong, s.net])).toEqual([
      [36, 4, 35],
      [15, 5, 13.75],
      [27, 4, 26],
      [18, 2, 17.5],
    ]);
    expect(st.score).toBe(418.276);
    expect(st.ranks).toEqual([
      { label: "Sınıf", rank: 1, of: null },
      { label: "Genel", rank: 835, of: null },
    ]);
  });
});

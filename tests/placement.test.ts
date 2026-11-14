import { describe, expect, it } from "vitest";
import { compareProgramsByCutoff, parseNumber, parseProgramTable, placementChance, readPlacementInput } from "@/lib/placement";

describe("Tercih robotu: sayı okuma", () => {
  it("Türkçe biçimli sayıları okur", () => {
    expect(parseNumber("452,12345")).toBeCloseTo(452.12345);
    expect(parseNumber("12.345", true)).toBe(12345);
    expect(parseNumber("1.234.567", true)).toBe(1234567);
    expect(parseNumber("1.234,5")).toBeCloseTo(1234.5);
    expect(parseNumber("%0,35")).toBeCloseTo(0.35);
    expect(parseNumber("0.35")).toBeCloseTo(0.35);
    expect(parseNumber("Dolmadı")).toBeNull();
    expect(parseNumber("---")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("Tercih robotu: tablo aktarımı", () => {
  it("YÖK Atlas çıktısında üstteki başlık satırlarını atlar, sütunları tanır", () => {
    const table = [
      ["2025 YKS Tercih Sihirbazı"],
      ["Program Kodu", "Üniversite Adı", "Fakülte", "Program Adı", "İl", "Puan Türü", "Üniversite Türü", "Burs", "Kontenjan", "Taban Puan", "Taban Başarı Sırası"],
      ["102210277", "ÖRNEK ÜNİVERSİTESİ", "Mühendislik Fakültesi", "Bilgisayar Mühendisliği", "Ankara", "Sayısal", "Devlet", "", "90", "480,12345", "25.400"],
      ["", "ÖRNEK VAKIF ÜNİVERSİTESİ", "", "Hukuk", "İstanbul", "EA", "Vakıf", "%50 İndirimli", "40", "Dolmadı", ""],
      ["", "", "", "", "", "", "", "", "", "", ""],
    ];
    const r = parseProgramTable("YKS", table);
    expect(r.missing).toEqual([]);
    expect(r.headerRow).toBe(1);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ code: "102210277", scoreType: "SAY", city: "ANKARA", minScore: 480.12345, minRank: 25400, quota: 90, kind: "Devlet" });
    expect(r.rows[1]).toMatchObject({ scoreType: "EA", minScore: null, minRank: null, details: "%50 İndirimli" });
    expect(r.rows[1].code).toMatch(/^X/);
  });

  it("zorunlu sütun eksikse söyler", () => {
    const r = parseProgramTable("LGS", [["Okul Adı", "İl", "İlçe", "Kontenjan"], ["Örnek Fen Lisesi", "İzmir", "Bornova", "150"]]);
    expect(r.missing).toContain("Taban puan ya da yüzdelik dilim");
    expect(r.rows).toHaveLength(0);
  });

  it("LGS tablosu: okul türü ve yüzdelik", () => {
    const r = parseProgramTable("LGS", [
      ["Kurum Kodu", "Okul Adı", "İl", "İlçe", "Okul Türü", "Pansiyon", "Kontenjan", "Taban Puan", "Yüzdelik Dilim"],
      ["123456", "Örnek Fen Lisesi", "izmir", "Bornova", "Fen Lisesi", "Var", "150", "487,3", "0,85"],
    ]);
    expect(r.rows[0]).toMatchObject({ code: "123456", city: "İZMİR", scoreType: "Fen Lisesi", percentile: 0.85, minScore: 487.3, details: "Var" });
  });
});

describe("Tercih robotu: yerleşme şansı", () => {
  it("YKS: başarı sırası oranına göre", () => {
    const p = { minScore: 450, minRank: 100_000, percentile: null };
    const at = (rank: number) => placementChance("YKS", p, { score: null, rank, percentile: null });
    expect(at(80_000)).toBe("high");
    expect(at(95_000)).toBe("medium");
    expect(at(115_000)).toBe("low");
    expect(at(140_000)).toBe("reach");
    expect(at(200_000)).toBeNull();
  });

  it("YKS: sıra yoksa puan farkına göre; tabanı olmayan program 'dolmadı'", () => {
    expect(placementChance("YKS", { minScore: 400, minRank: null, percentile: null }, { score: 405, rank: null, percentile: null })).toBe("medium");
    expect(placementChance("YKS", { minScore: 400, minRank: null, percentile: null }, { score: 385, rank: null, percentile: null })).toBe("reach");
    expect(placementChance("YKS", { minScore: null, minRank: null, percentile: null }, { score: 300, rank: null, percentile: null })).toBe("open");
    expect(placementChance("YKS", { minScore: 400, minRank: null, percentile: null }, { score: null, rank: null, percentile: null })).toBeNull();
  });

  it("LGS: yüzdelik dilim (küçük daha iyi), yoksa puan", () => {
    const p = { minScore: 470, minRank: null, percentile: 2 };
    expect(placementChance("LGS", p, { score: null, rank: null, percentile: 1.5 })).toBe("high");
    expect(placementChance("LGS", p, { score: null, rank: null, percentile: 2 })).toBe("medium");
    expect(placementChance("LGS", p, { score: null, rank: null, percentile: 2.4 })).toBe("low");
    expect(placementChance("LGS", p, { score: null, rank: null, percentile: 4 })).toBeNull();
    expect(placementChance("LGS", p, { score: 480, rank: null, percentile: null })).toBe("high");
    expect(placementChance("LGS", p, { score: 466, rank: null, percentile: null })).toBe("low");
  });

  it("form girdisi aralık dışını yok sayar; en iyi taban önce sıralanır", () => {
    expect(readPlacementInput("LGS", { score: "520", percentile: "3,5" })).toEqual({ score: null, rank: null, percentile: 3.5 });
    expect(readPlacementInput("YKS", { score: "412,3", rank: "85.000" })).toEqual({ score: 412.3, rank: 85000, percentile: null });
    const list = [
      { minScore: 300, minRank: 400_000, percentile: null },
      { minScore: 500, minRank: 1_000, percentile: null },
      { minScore: null, minRank: null, percentile: null },
    ].sort(compareProgramsByCutoff);
    expect(list.map((p) => p.minRank)).toEqual([1_000, 400_000, null]);
  });
});

describe("Tercih robotu: hedef okul", () => {
  it("programın deneme türü puan türünden gelir", async () => {
    const { goalKindForProgram } = await import("@/lib/placement");
    expect(goalKindForProgram("LGS", "Fen Lisesi")).toBe("LGS");
    expect(goalKindForProgram("YKS", "SAY")).toBe("AYT_SAY");
    expect(goalKindForProgram("YKS", "SÖZ")).toBe("AYT_SOZ");
    expect(goalKindForProgram("YKS", "DİL")).toBe("YDT");
    expect(goalKindForProgram("YKS", "TYT")).toBe("TYT");
  });

  it("tabana kalan puan, şans ve gidişat", async () => {
    const { targetProgress } = await import("@/lib/placement");
    const p = { minScore: 400, minRank: 50_000, percentile: null };
    expect(targetProgress("YKS", p, [])).toEqual({ last: null, gap: null, chance: null, trend: null });
    expect(targetProgress("YKS", p, [360, 380, 395])).toEqual({ last: 395, gap: 5, chance: "low", trend: 35 });
    expect(targetProgress("YKS", p, [420])).toMatchObject({ gap: -20, chance: "high", trend: null });
  });
});

// Tercih robotu (LGS / YKS): yüklenen tablonun sütunlarını tanıma, sayı okuma ve yerleşme şansı.
// Veri yönetimden Excel/CSV ile gelir; sütun adları YÖK Atlas ve MEB listelerindeki adlarla eşleşir.

export type PlacementExamName = "LGS" | "YKS";

export const PLACEMENT_EXAMS: Record<PlacementExamName, { label: string; title: string; slug: string; listMax: number }> = {
  LGS: { label: "LGS", title: "LGS tercih robotu", slug: "lgs-tercih", listMax: 5 },
  YKS: { label: "YKS", title: "YKS tercih robotu", slug: "yks-tercih", listMax: 24 },
};

export const YKS_SCORE_TYPES = ["SAY", "EA", "SÖZ", "DİL", "TYT"] as const;
export const YKS_SCORE_TYPE_LABEL: Record<string, string> = { SAY: "Sayısal (SAY)", EA: "Eşit ağırlık (EA)", SÖZ: "Sözel (SÖZ)", DİL: "Dil (DİL)", TYT: "Önlisans (TYT)" };

export type ProgramRow = {
  code: string;
  name: string;
  institution: string | null;
  faculty: string | null;
  city: string;
  district: string | null;
  scoreType: string;
  kind: string | null;
  details: string | null;
  quota: number | null;
  placed: number | null;
  minScore: number | null;
  maxScore: number | null;
  minRank: number | null;
  percentile: number | null;
};

type Field = keyof ProgramRow | "detail";

/** Başlığı karşılaştırılabilir hâle getirir: "Taban Başarı Sırası" → "tabanbasarisirasi" */
export function headerKey(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
}

const HEADERS: Record<string, Field> = {};
function alias(field: Field, ...names: string[]) {
  for (const n of names) HEADERS[headerKey(n)] = field;
}
alias("code", "Program Kodu", "Kod", "Kurum Kodu", "Okul Kodu", "Program Kod", "Kodu");
alias("institution", "Üniversite", "Üniversite Adı", "Yükseköğretim Kurumu", "Kurum Adı (Üniversite)");
alias("faculty", "Fakülte", "Fakülte / Yüksekokul", "Fakülte/Yüksekokul", "Fakülte/Yüksekokul Adı", "Fakülte Adı", "Birim");
alias("name", "Program Adı", "Program", "Bölüm", "Bölüm Adı", "Okul Adı", "Okul", "Lise", "Kurum Adı", "Lise Adı");
alias("city", "İl", "Şehir", "İl Adı", "Ili");
alias("district", "İlçe", "İlçe Adı");
alias("scoreType", "Puan Türü", "Puan Tipi", "Okul Türü", "Okul Tipi", "Kurum Türü", "Lise Türü");
alias("kind", "Üniversite Türü", "Üniversite Tipi", "Devlet/Vakıf", "Devlet / Vakıf", "Kurum Tipi");
alias("detail", "Burs", "Burs Oranı", "Öğretim Türü", "Öğrenim Türü", "Yabancı Dil", "Dil", "Pansiyon", "Açıklama", "Özel Koşul", "Hazırlık", "Öğrenim Dili");
alias("quota", "Kontenjan", "Genel Kontenjan", "Kont.", "Toplam Kontenjan");
alias("placed", "Yerleşen", "Yerleşen Sayısı", "Yerleşen Aday");
alias("minScore", "Taban Puan", "Taban Puanı", "Taban", "En Küçük Puan", "En Düşük Puan", "Min Puan", "Taban Puan (LGS)");
alias("maxScore", "Tavan Puan", "Tavan Puanı", "Tavan", "En Büyük Puan", "En Yüksek Puan", "Max Puan");
alias("minRank", "Başarı Sırası", "Taban Başarı Sırası", "En Küçük Başarı Sırası", "Başarı Sıralaması", "Taban Sıralama", "Sıralama");
alias("percentile", "Yüzdelik", "Yüzdelik Dilim", "Yüzdelik Dilimi", "Taban Yüzdelik", "Taban Yüzdelik Dilim");

/** Türkçe biçimli sayı: "452,123" → 452.123 · "12.345" (tam sayı alanı) → 12345 · "Dolmadı" → null */
export function parseNumber(raw: string, integer = false): number | null {
  let s = String(raw ?? "").trim().replace(/[%\s]/g, "");
  if (!s || !/\d/.test(s)) return null;
  // "1.234.567" gibi ya da "452,12" gibi
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (integer && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.round(n) : n;
}

/** YKS puan türü: "Sayısal" → "SAY" */
export function normalizeScoreType(exam: PlacementExamName, raw: string): string {
  const v = raw.trim();
  if (exam === "LGS") return v.replace(/\s+/g, " ");
  const k = headerKey(v);
  if (k.startsWith("say")) return "SAY";
  if (k === "ea" || k.startsWith("esit")) return "EA";
  if (k.startsWith("soz")) return "SÖZ";
  if (k.startsWith("dil")) return "DİL";
  if (k.startsWith("tyt") || k.startsWith("onlisans")) return "TYT";
  return v.toLocaleUpperCase("tr-TR");
}

const PROVINCES =
  "ADANA,ADIYAMAN,AFYONKARAHİSAR,AĞRI,AMASYA,ANKARA,ANTALYA,ARTVİN,AYDIN,BALIKESİR,BİLECİK,BİNGÖL,BİTLİS,BOLU,BURDUR,BURSA,ÇANAKKALE,ÇANKIRI,ÇORUM,DENİZLİ,DİYARBAKIR,EDİRNE,ELAZIĞ,ERZİNCAN,ERZURUM,ESKİŞEHİR,GAZİANTEP,GİRESUN,GÜMÜŞHANE,HAKKARİ,HATAY,ISPARTA,MERSİN,İSTANBUL,İZMİR,KARS,KASTAMONU,KAYSERİ,KIRKLARELİ,KIRŞEHİR,KOCAELİ,KONYA,KÜTAHYA,MALATYA,MANİSA,KAHRAMANMARAŞ,MARDİN,MUĞLA,MUŞ,NEVŞEHİR,NİĞDE,ORDU,RİZE,SAKARYA,SAMSUN,SİİRT,SİNOP,SİVAS,TEKİRDAĞ,TOKAT,TRABZON,TUNCELİ,ŞANLIURFA,UŞAK,VAN,YOZGAT,ZONGULDAK,AKSARAY,BAYBURT,KARAMAN,KIRIKKALE,BATMAN,ŞIRNAK,BARTIN,ARDAHAN,IĞDIR,YALOVA,KARABÜK,KİLİS,OSMANİYE,DÜZCE".split(",");
/** Adında il geçmeyen ve ÖSYM tablosunda parantezle il yazılmayan üniversiteler */
const UNIVERSITY_CITY: Record<string, string> = { "GEBZE TEKNİK ÜNİVERSİTESİ": "KOCAELİ", "TÜRK-JAPON BİLİM VE TEKNOLOJİ ÜNİVERSİTESİ": "İSTANBUL" };

/**
 * İl sütunu olmayan ÖSYM tablosu (en küçük ve en büyük puanlar): il üniversite adından çıkarılır.
 * "ABDULLAH GÜL ÜNİVERSİTESİ (KAYSERİ)" → KAYSERİ · "(KKTC-GİRNE)" → GİRNE · "(BAKÜ-AZERBAYCAN)" → BAKÜ · "ZONGULDAK BÜLENT ECEVİT ÜNİVERSİTESİ" → ZONGULDAK
 */
export function cityFromInstitution(institution: string): string | null {
  const name = institution.trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR");
  if (!name) return null;
  const paren = name.match(/\(([^)]+)\)\s*$/)?.[1];
  if (paren) {
    const parts = paren.split("-").map((p) => p.trim()).filter(Boolean);
    return (parts[0] === "KKTC" ? parts[1] : parts[0]) ?? null;
  }
  if (UNIVERSITY_CITY[name]) return UNIVERSITY_CITY[name];
  const words = name.split(/[\s-]+/);
  return PROVINCES.find((p) => words.includes(p)) ?? null;
}

/** "DEVLET" → "Devlet", "YURTDISI KAMU" → "Yurt dışı devlet" */
function normalizeKind(raw: string): string {
  const k = headerKey(raw);
  if (k === "devlet") return "Devlet";
  if (k === "vakif") return "Vakıf";
  if (k === "kktc") return "KKTC";
  if (k === "yurtdisivakif") return "Yurt dışı vakıf";
  if (k === "yurtdisikamu" || k === "yurtdisidevlet") return "Yurt dışı devlet";
  return raw.trim();
}

function titleCity(v: string): string {
  const s = v.trim().replace(/\s+/g, " ");
  return s ? s.toLocaleUpperCase("tr-TR") : s;
}

/** Kodu olmayan satır için kararlı kod (ad + kurum + il + tür) */
function fallbackCode(parts: string[]): string {
  let h = 2166136261;
  for (const ch of parts.join("|")) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return `X${(h >>> 0).toString(36).toUpperCase()}`;
}

export type ParseResult = { rows: ProgramRow[]; skipped: number; headerRow: number; columns: string[]; missing: string[] };

/**
 * Tablo → program satırları. Başlık satırı ilk 15 satırda aranır (YÖK Atlas çıktısının üstünde başlık metni olabilir).
 * Zorunlu: ad, il; LGS'de taban puan ya da yüzdelik, YKS'de puan türü.
 */
export function parseProgramTable(exam: PlacementExamName, table: string[][]): ParseResult {
  let headerRow = -1;
  let map: (Field | null)[] = [];
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const m = table[i].map((h) => HEADERS[headerKey(h)] ?? null);
    // En az üç farklı alan (ÖSYM tablosunda üst satırda dört kez "Genel Kontenjan" yazar)
    if (new Set(m.filter(Boolean)).size >= 3) {
      headerRow = i;
      map = m;
      break;
    }
  }
  const has = (f: Field) => map.includes(f);
  const missing: string[] = [];
  if (!has("name")) missing.push(exam === "LGS" ? "Okul adı" : "Program adı");
  // ÖSYM tablosunda il sütunu yok: üniversite adından çıkarılır
  const cityFromName = !has("city") && exam === "YKS" && has("institution");
  if (!has("city") && !cityFromName) missing.push("İl");
  if (exam === "YKS" && !has("scoreType")) missing.push("Puan türü");
  if (exam === "LGS" && !has("minScore") && !has("percentile")) missing.push("Taban puan ya da yüzdelik dilim");
  if (exam === "YKS" && !has("minScore") && !has("minRank")) missing.push("Taban puan ya da başarı sırası");
  const columns = headerRow >= 0 ? table[headerRow].filter((_, i) => map[i]) : [];
  if (headerRow < 0 || missing.length) return { rows: [], skipped: 0, headerRow, columns, missing: headerRow < 0 ? ["Başlık satırı bulunamadı"] : missing };

  const rows: ProgramRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const cells of table.slice(headerRow + 1)) {
    const get = (f: Field) => {
      const i = map.indexOf(f);
      return i >= 0 ? (cells[i] ?? "").trim() : "";
    };
    const details = map.map((f, i) => (f === "detail" ? (cells[i] ?? "").trim() : "")).filter((v) => v && v !== "-" && v !== "—");
    const name = get("name").replace(/\s+/g, " ");
    const city = cityFromName ? (cityFromInstitution(get("institution")) ?? "") : titleCity(get("city"));
    // ÖSYM: yüksekokulun ilçesi parantezde ("MESLEK YÜKSEKOKULU (Devrek)")
    const district = get("district") || (cityFromName ? (get("faculty").match(/\(([^)]+)\)\s*$/)?.[1] ?? "") : "");
    const scoreType = normalizeScoreType(exam, get("scoreType")) || (exam === "LGS" ? "Lise" : "");
    if (!name || !city || !scoreType) {
      skipped++;
      continue;
    }
    const institution = get("institution") || null;
    let code = get("code").replace(/\s+/g, "");
    if (!code) code = fallbackCode([name, institution ?? "", city, district, scoreType, details.join(" ")]);
    if (seen.has(code)) {
      skipped++;
      continue;
    }
    seen.add(code);
    const percentile = parseNumber(get("percentile"));
    rows.push({
      code: code.slice(0, 40),
      name: name.slice(0, 300),
      institution: institution?.slice(0, 200) ?? null,
      faculty: get("faculty").slice(0, 200) || null,
      city: city.slice(0, 60),
      district: district.slice(0, 60) || null,
      scoreType: scoreType.slice(0, 60),
      kind: normalizeKind(get("kind")).slice(0, 40) || null,
      details: details.join(" · ").slice(0, 300) || null,
      quota: parseNumber(get("quota"), true),
      placed: parseNumber(get("placed"), true),
      minScore: parseNumber(get("minScore")),
      maxScore: parseNumber(get("maxScore")),
      minRank: parseNumber(get("minRank"), true),
      percentile: percentile !== null && percentile >= 0 && percentile <= 100 ? percentile : null,
    });
  }
  return { rows, skipped, headerRow, columns, missing: [] };
}

// ——— Yerleşme şansı ———

export type Chance = "high" | "medium" | "low" | "reach" | "open";

export const CHANCE_LABEL: Record<Chance, string> = {
  high: "Güvenli",
  medium: "Uygun",
  low: "Riskli",
  reach: "Hayal tercihi",
  open: "Geçen yıl dolmadı",
};
export const CHANCE_TONE: Record<Chance, "green" | "brand" | "amber" | "rose" | "slate"> = {
  high: "green",
  medium: "brand",
  low: "amber",
  reach: "rose",
  open: "slate",
};
export const CHANCE_ORDER: Chance[] = ["high", "medium", "low", "reach", "open"];

export type PlacementInput = { score: number | null; rank: number | null; percentile: number | null };

type ChanceProgram = Pick<ProgramRow, "minScore" | "minRank" | "percentile">;

/**
 * Geçen yılın tabanına göre tahmin. YKS'de başarı sırası, LGS'de yüzdelik dilim puandan daha sağlıklıdır (yıllar arası
 * puan dağılımı değişir); ikisi de yoksa puan farkına bakılır. Uzak kalan program için null (listede gösterilmez).
 */
export function placementChance(exam: PlacementExamName, program: ChanceProgram, input: PlacementInput): Chance | null {
  const hasInput = input.score !== null || input.rank !== null || input.percentile !== null;
  if (!hasInput) return null;
  if (program.minScore === null && program.minRank === null && program.percentile === null) return "open";
  if (exam === "YKS") {
    if (input.rank !== null && input.rank > 0 && program.minRank !== null && program.minRank > 0) {
      const r = input.rank / program.minRank;
      return r <= 0.85 ? "high" : r <= 1 ? "medium" : r <= 1.2 ? "low" : r <= 1.5 ? "reach" : null;
    }
    if (input.score !== null && program.minScore !== null) {
      const d = input.score - program.minScore;
      return d >= 10 ? "high" : d >= 0 ? "medium" : d >= -8 ? "low" : d >= -20 ? "reach" : null;
    }
    return null;
  }
  if (input.percentile !== null && input.percentile > 0 && program.percentile !== null && program.percentile > 0) {
    const r = input.percentile / program.percentile;
    return r <= 0.8 ? "high" : r <= 1 ? "medium" : r <= 1.25 ? "low" : r <= 1.6 ? "reach" : null;
  }
  if (input.score !== null && program.minScore !== null) {
    const d = input.score - program.minScore;
    return d >= 8 ? "high" : d >= 0 ? "medium" : d >= -6 ? "low" : d >= -15 ? "reach" : null;
  }
  return null;
}

/** Sıralama: en "iyi" program önce (sıra / yüzdelik küçük, puan büyük); verisi olmayan sonda. */
export function compareProgramsByCutoff(a: ChanceProgram, b: ChanceProgram): number {
  const key = (p: ChanceProgram) => (p.minRank !== null ? p.minRank : p.percentile !== null ? p.percentile * 100_000 : p.minScore !== null ? 1e9 - p.minScore * 1000 : Infinity);
  return key(a) - key(b);
}

/** Formdan gelen puan bilgisi (boş = null; aralık dışı = null) */
export function readPlacementInput(exam: PlacementExamName, raw: { score?: unknown; rank?: unknown; percentile?: unknown }): PlacementInput {
  const num = (v: unknown, integer = false) => (typeof v === "string" ? parseNumber(v, integer) : typeof v === "number" ? v : null);
  const score = num(raw.score);
  const rank = exam === "YKS" ? num(raw.rank, true) : null;
  const percentile = exam === "LGS" ? num(raw.percentile) : null;
  return {
    score: score !== null && score > 0 && score <= (exam === "LGS" ? 500 : 600) ? score : null,
    rank: rank !== null && rank > 0 && rank < 10_000_000 ? rank : null,
    percentile: percentile !== null && percentile > 0 && percentile <= 100 ? percentile : null,
  };
}

export function formatScore(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}
export function formatPercentile(v: number | null): string {
  return v === null ? "—" : `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}

/** Hedef programın deneme türü: LGS okulu → LGS; YKS programı puan türüne göre (SAY → AYT Sayısal …). */
export function goalKindForProgram(exam: PlacementExamName, scoreType: string): "LGS" | "TYT" | "AYT_SAY" | "AYT_EA" | "AYT_SOZ" | "YDT" {
  if (exam === "LGS") return "LGS";
  const map: Record<string, "TYT" | "AYT_SAY" | "AYT_EA" | "AYT_SOZ" | "YDT"> = { SAY: "AYT_SAY", EA: "AYT_EA", SÖZ: "AYT_SOZ", DİL: "YDT", TYT: "TYT" };
  return map[scoreType] ?? "TYT";
}

/** Hedefe uzaklık: son deneme puanı ile taban farkı (pozitif: kalan puan), yerleşme şansı ve gidişat. */
export function targetProgress(exam: PlacementExamName, program: { minScore: number | null; minRank: number | null; percentile: number | null }, scores: number[]) {
  const last = scores.length ? scores[scores.length - 1] : null;
  const gap = last !== null && program.minScore !== null ? Math.round((program.minScore - last) * 100) / 100 : null;
  const chance = last !== null ? placementChance(exam, program, { score: last, rank: null, percentile: null }) : null;
  // Gidişat: son üç denemenin ilkiyle sonuncusu arasındaki fark
  const recent = scores.slice(-3);
  const trend = recent.length >= 2 ? Math.round((recent[recent.length - 1] - recent[0]) * 100) / 100 : null;
  return { last, gap, chance, trend };
}

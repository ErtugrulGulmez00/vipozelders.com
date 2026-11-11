import { z } from "zod";
import { foldTurkish } from "@/lib/text";
import { detectKind, guessSubject, inferPenalty, type PdfExam, type PdfExamSection, type PdfItem, type PdfStudent, type PdfStudentSection } from "./exam-pdf";
import { computeNet, EXAM_PRESETS } from "./exams";

// Tanınmayan sonuç PDF'ini yapay zekâyla okumanın saf kısmı: sayfaları satır metnine çevirme, kurumdaki öğrenci
// adlarını kodlama (ad yapay zekâya gitmez), yanıtı ayrıştırma, denemeleri birleştirme ve tutarlılık denetimi.

// ——— Sayfa metni ———

/**
 * Konumlu parçalardan satır metni: aynı yükseklikteki parçalar soldan sağa, sütun boşlukları " | " ile. Tablo hücresinde
 * iki satıra sarmış ad ("ARSLAN" üstte, "YAĞMUR" altta) en yakın tablo satırına geri eklenir.
 */
export function pageText(items: PdfItem[]): string {
  const rows: { y: number; items: PdfItem[] }[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const row = rows.find((r) => Math.abs(r.y - item.y) <= 2.5);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  const orphan = (r: (typeof rows)[number]) => r.items.length > 0 && r.items.length <= 2 && !r.items.some((i) => /\d/.test(i.str));
  const tableRows = rows.filter((r) => r.items.length >= 3);
  for (const row of rows.filter(orphan)) {
    let best: (typeof rows)[number] | null = null;
    for (const t of tableRows) if (!best || Math.abs(t.y - row.y) < Math.abs(best.y - row.y)) best = t;
    if (best && Math.abs(best.y - row.y) <= 14) {
      best.items.push(...row.items);
      row.items = [];
    }
  }
  return rows
    .map((row) => {
      // Aynı sütunda üst üste duran parçalar (sarmış hücre) yukarıdan aşağı okunur
      const sorted = row.items.sort((a, b) => (Math.abs(a.x - b.x) < 2 ? b.y - a.y : a.x - b.x));
      let line = "";
      let end = -Infinity;
      for (const item of sorted) {
        const text = item.str.trim();
        if (!text) continue;
        if (line) line += item.x - end > 6 ? " | " : " ";
        line += text;
        end = item.x + item.w;
      }
      return line;
    })
    .filter(Boolean)
    .join("\n");
}

// ——— Ad kodlama ———

export type KnownStudent = { id: string; firstName: string; lastName: string };
export type NameCodes = { text: string; codes: Map<string, string> };

const fold = (s: string) => foldTurkish(s).toLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Kurumda kayıtlı öğrencilerin adlarını metinde "OGR12" koduyla değiştirir ("Ad Soyad" ya da "SOYAD AD"; büyük/küçük
 * harf ve Türkçe karakter farkı gözetmez). Kod → PDF'teki asıl yazım eşlemesi yalnızca bizde kalır.
 */
export function codeNames(text: string, students: KnownStudent[], codes: Map<string, string> = new Map()): NameCodes {
  // foldTurkish karakter karakter çevirir; küçük harfe çevirme de ASCII'de uzunluğu korur → konumlar asıl metinle aynı
  const folded = fold(text);
  if (folded.length !== text.length) return { text, codes };
  const patterns = students
    .flatMap((s, i) => {
      const first = fold(s.firstName).trim().split(/\s+/).filter(Boolean);
      const last = fold(s.lastName).trim().split(/\s+/).filter(Boolean);
      if (!first.length || !last.length) return [];
      const words = (list: string[]) => list.map(escape).join("\\s+");
      return [
        { i, re: `${words(first)}\\s+${words(last)}` },
        { i, re: `${words(last)}\\s+${words(first)}` },
      ];
    })
    // Uzun adlar önce (ör. "Ali Can Yılmaz" "Ali Yılmaz"dan önce)
    .sort((a, b) => b.re.length - a.re.length);
  const taken: { start: number; end: number; token: string }[] = [];
  const existing = new Map([...codes].map(([token, name]) => [fold(name), token]));
  for (const { re } of patterns) {
    for (const m of folded.matchAll(new RegExp(`(?<![a-z0-9])${re}(?![a-z0-9])`, "g"))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some((t) => start < t.end && end > t.start)) continue;
      const original = text.slice(start, end).replace(/\s+/g, " ");
      let token = existing.get(fold(original));
      if (!token) {
        token = `OGR${codes.size + 1}`;
        codes.set(token, original);
        existing.set(fold(original), token);
      }
      taken.push({ start, end, token });
    }
  }
  let out = text;
  for (const t of taken.sort((a, b) => b.start - a.start)) out = out.slice(0, t.start) + t.token + out.slice(t.end);
  return { text: codeNameWords(out, students, codes), codes };
}

// Ad sözcüğü olarak kodlanmayacak rapor sözcükleri (bir öğrencinin adı bunlarla aynıysa bile)
const REPORT_WORDS = new Set(
  ["fen", "din", "net", "puan", "sinif", "okul", "kurum", "ders", "deneme", "turkce", "matematik", "fizik", "kimya", "biyoloji", "tarih", "cografya", "ingilizce", "sosyal", "temel", "genel", "ortak", "dogru", "yanlis", "bos", "toplam", "sira", "soyad", "soyadi", "adi", "ogrenci", "sonuc"],
);

/**
 * Güvenlik ağı: tam ad yakalanamadıysa (satıra bölünmüş, araya başka yazı girmiş) kurumdaki öğrencilerin ad ve
 * soyadları sözcük sözcük "AD7" koduyla değiştirilir; ad parçası da yapay zekâya açık gitmez.
 */
function codeNameWords(text: string, students: KnownStudent[], codes: Map<string, string>): string {
  const folded = fold(text);
  if (folded.length !== text.length) return text;
  const words = new Set(
    students.flatMap((s) => fold(`${s.firstName} ${s.lastName}`).split(/\s+/)).filter((w) => w.length >= 3 && !REPORT_WORDS.has(w.replace(/[^a-z]/g, ""))),
  );
  if (!words.size) return text;
  const existing = new Map([...codes].map(([token, word]) => [fold(word), token]));
  const re = new RegExp(`(?<![a-z0-9])(?:${[...words].sort((a, b) => b.length - a.length).map(escape).join("|")})(?![a-z0-9])`, "g");
  const hits = [...folded.matchAll(re)];
  let out = text;
  for (const m of hits.reverse()) {
    const original = text.slice(m.index, m.index + m[0].length);
    let token = existing.get(m[0]);
    if (!token) {
      token = `AD${codes.size + 1}`;
      codes.set(token, original);
      existing.set(m[0], token);
    }
    out = out.slice(0, m.index) + token + out.slice(m.index + m[0].length);
  }
  return out;
}

/** Yapay zekânın döndürdüğü addaki kodları asıl yazıma çevirir. */
export function decodeName(name: string, codes: Map<string, string>): string {
  return name.replace(/\b(?:OGR|AD)\d+\b/g, (token) => codes.get(token) ?? token).replace(/\s+/g, " ").trim();
}

// ——— İstem ———

export const AI_SYSTEM = `Sen Türkiye'deki deneme sınavı sonuç raporlarını okuyan bir veri çıkarma aracısın.
Sana bir yayınevinin ya da sonuç sisteminin PDF raporundan çıkarılmış düz metin verilir (sütunlar " | " ile ayrılmıştır).
Görevin metindeki denemeyi ve öğrenci sonuçlarını YALNIZCA JSON olarak döndürmek. Açıklama, markdown, kod bloğu yazma.

Kurallar:
- Metinde olmayan hiçbir şeyi uydurma. Bulamadığın alanı null ya da boş bırak.
- "OGR12" gibi kodlar öğrenci adı, "AD7" gibi kodlar ad ya da soyad parçasıdır. Adı metindeki kodlarla aynen yaz (ör. "AD3 AD7"); kodları değiştirme, birleştirme ya da açma.
- Bir hücre iki satıra sarmış olabilir: adın parçaları aynı öğrencinin satırının hemen üstünde ve altında durur.
- Dersler denemedeki sırasıyla yazılır (ör. LGS: Türkçe 20, T.C. İnkılap Tarihi 10, Din Kültürü 10, Yabancı Dil 10, Matematik 20, Fen Bilimleri 20).
- Her öğrenci için her derste doğru (D), yanlış (Y) ve net (N) sayısını yaz. Ondalıkta nokta kullan (12,33 → 12.33).
- Öğrencinin girmediği ya da raporda olmayan ders için null yaz; uydurma.
- Cevap anahtarı ve öğrencinin şıkları metinde varsa ders başına soru sırasıyla tek dize yaz (ör. "ABCDA..."; boş soru "-").
- Soru soru kazanım/konu listesi varsa ders başına soru sayısı uzunluğunda dizi yaz (konusu yazılmayan soru ""), yoksa [].
- "score" yalnızca raporda puan (ör. LGS puanı, TYT puanı) yazıyorsa doldurulur; toplam neti puan olarak yazma.
- Sıralamalar (sınıf, kurum, il, genel) varsa yaz; yoksa boş bırak.
- Rapor birden çok deneme içeriyorsa her birini ayrı yaz.

Şema:
{"exams":[{"name":"deneme adı","institution":"kurum/okul adı ya da boş","sections":[{"name":"ders adı","questionCount":20,"answerKey":null,"topics":[]}],"students":[{"name":"OGR1","number":"öğrenci no ya da boş","className":"şube ya da boş","score":null,"ranks":[{"label":"Sınıf","rank":3,"of":40}],"sections":[{"correct":15,"wrong":3,"net":14,"answers":null}]}]}]}`;

export function aiPrompt(text: string, part: { index: number; total: number }): string {
  const head = part.total > 1 ? `Bu metin raporun ${part.index}/${part.total}. parçası; yalnızca bu parçadaki öğrencileri yaz, deneme ve ders bilgisini her parçada tekrar yaz.\n\n` : "";
  return `${head}RAPOR METNİ:\n${text}`;
}

// ——— Yanıt ———

const num = z.preprocess((v) => (typeof v === "string" ? Number(v.replace(",", ".").trim()) : v), z.number().finite());
const numOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : v), num.nullable());
const str = z.preprocess((v) => (v === null || v === undefined ? "" : String(v)), z.string());

const aiSection = z.object({ correct: num, wrong: num, net: numOrNull, answers: z.string().nullish() }).nullable();
const aiStudent = z.object({
  name: str,
  number: str.optional(),
  className: str.optional(),
  score: numOrNull.optional(),
  ranks: z.array(z.object({ label: str, rank: num, of: numOrNull.optional() })).optional(),
  sections: z.array(aiSection.catch(null)),
});
const aiExam = z.object({
  name: str,
  institution: str.optional(),
  sections: z.array(z.object({ name: str, questionCount: num, answerKey: z.string().nullish(), topics: z.array(str).optional() })).min(1),
  students: z.array(aiStudent.nullable().catch(null)),
});
const aiResponse = z.object({ exams: z.array(aiExam) });
export type AiExam = z.infer<typeof aiExam>;

/** Yanıttaki JSON'u çıkarır (kod bloğu ya da baştaki/sondaki açıklama olsa da). Geçersizse null. */
export function parseAiResponse(raw: string): AiExam[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = aiResponse.safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data.exams : null;
  } catch {
    return null;
  }
}

// ——— Birleştirme ve denetim ———

const key = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");
const round2 = (n: number) => Math.round(n * 100) / 100;
const cleanAnswers = (s: string | null | undefined, count: number) => {
  const v = (s ?? "").toUpperCase().replace(/\s/g, "");
  return v.length === count && /^[A-E-]+$/.test(v) ? v : null;
};

/** Parçalardan gelen denemeleri ada göre birleştirir, öğrenci adlarını çözer, ders yapısını şablona oturtur. */
export function buildExams(parts: AiExam[][], codes: Map<string, string>): PdfExam[] {
  const groups = new Map<string, AiExam[]>();
  for (const exam of parts.flat()) {
    const k = key(exam.name) || "deneme";
    groups.set(k, [...(groups.get(k) ?? []), exam]);
  }
  const exams: PdfExam[] = [];
  for (const list of groups.values()) {
    const base = list.reduce((best, e) => (e.sections.length > best.sections.length ? e : best), list[0]);
    const counts = base.sections.map((s) => Math.round(s.questionCount));
    const kind = detectKind(base.name, counts);
    const preset = EXAM_PRESETS[kind];
    const baseKeys = base.sections.map((s) => key(s.name));

    const students: PdfStudent[] = [];
    for (const exam of list) {
      const own = exam.sections.map((s) => key(s.name));
      // Parçadaki ders sırası farklıysa adla eşlenir; ad tutmazsa (aynı sayıda ders varsa) sırayla
      const indexOf = (i: number) => {
        const byName = own.indexOf(baseKeys[i]);
        if (byName >= 0) return byName;
        return own.length === baseKeys.length ? i : -1;
      };
      for (const st of exam.students) {
        if (!st) continue;
        const sections = base.sections.map((section, i): PdfStudentSection | null => {
          const j = indexOf(i);
          const s = j >= 0 ? st.sections[j] : null;
          if (!s) return null;
          const net = s.net ?? computeNet(s.correct, s.wrong, preset.wrongPenalty);
          return { correct: s.correct, wrong: s.wrong, net: round2(net), answers: cleanAnswers(s.answers, Math.round(section.questionCount)) };
        });
        if (!sections.some(Boolean)) continue;
        students.push({
          name: decodeName(st.name, codes),
          number: (st.number ?? "").trim(),
          className: (st.className ?? "").trim(),
          score: st.score ?? null,
          ranks: (st.ranks ?? []).filter((r) => r.label && r.rank > 0).map((r) => ({ label: r.label, rank: Math.round(r.rank), of: r.of ? Math.round(r.of) : null })),
          sections,
        });
      }
    }
    if (!students.length) continue;

    const penalty = inferPenalty(students.flatMap((s) => s.sections.filter((x): x is PdfStudentSection => Boolean(x)))) ?? preset.wrongPenalty;
    const sections: PdfExamSection[] = base.sections.map((s, i) => {
      const questionCount = counts[i];
      const presetSection = kind !== "CUSTOM" ? preset.sections[i] : null;
      const topics = s.topics?.length === questionCount ? s.topics.map((t) => t.trim()) : [];
      return {
        label: s.name,
        name: presetSection?.name ?? s.name,
        questionCount,
        answerKey: cleanAnswers(s.answerKey, questionCount),
        topics: topics.some(Boolean) ? topics : [],
        subjectSlug: presetSection?.subjectSlug ?? guessSubject(s.name),
      };
    });
    // Öğrenci şıkları ancak anahtar varsa işe yarar
    for (const st of students) st.sections.forEach((s, i) => { if (s && !sections[i].answerKey) s.answers = null; });

    const exam: PdfExam = { name: base.name.trim() || "Deneme", institution: (base.institution ?? "").trim(), kind, wrongPenalty: penalty, sections, students, source: "ai" };
    validateExam(exam);
    exams.push(exam);
  }
  return exams;
}

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/** Satır satır tutarlılık denetimi; uyarılar öğrenciye yazılır (eşleştirme ekranında kırmızı). */
export function validateExam(exam: PdfExam): PdfExam {
  for (const st of exam.students) {
    const warnings: string[] = [];
    st.sections.forEach((s, i) => {
      if (!s) return;
      const section = exam.sections[i];
      const label = section.name;
      if (s.correct < 0 || s.wrong < 0 || !Number.isInteger(s.correct) || !Number.isInteger(s.wrong)) warnings.push(`${label}: doğru/yanlış sayısı geçersiz`);
      else if (s.correct + s.wrong > section.questionCount) warnings.push(`${label}: doğru + yanlış (${s.correct + s.wrong}) soru sayısını (${section.questionCount}) aşıyor`);
      else {
        const expected = computeNet(s.correct, s.wrong, exam.wrongPenalty);
        if (Math.abs(expected - s.net) > 0.06) warnings.push(`${label}: net tutmuyor (PDF'te ${fmt(s.net)}, hesap ${fmt(expected)})`);
      }
    });
    if (!st.name.trim() && !st.number.trim()) warnings.push("Öğrenci adı ve numarası okunamadı");
    st.warnings = warnings.length ? warnings : undefined;
  }
  return exam;
}

/** Sayfa metinlerini yaklaşık karakter sınırına göre parçalar (bir sayfa bölünmez). */
export function chunkPages(texts: string[], maxChars = 12_000): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const [i, text] of texts.entries()) {
    const page = `--- Sayfa ${i + 1} ---\n${text}`;
    if (current && current.length + page.length > maxChars) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + page;
  }
  if (current) chunks.push(current);
  return chunks;
}

import type { PdfExam, PdfExamSection, PdfItem, PdfStudent } from "./exam-pdf";
import { assignTopics, bookletShift, detectKind, guessSubject, inferPenalty } from "./exam-pdf";
import { EXAM_PRESETS, gradeAnswers, type QuestionOutcome } from "./exams";

// Akbim ODS "SINAV SONUÇ BELGESİ" (ör. YÜZ TÖDER, birçok yayının ortak sonuç sistemi): öğrenci başına bir sayfa.
// - Üstte DERSLER tablosu: sütun başına SORU SAYISI / DOĞRU / YANLIŞ / NET (sorusu 0 olan sütunlar o sınavda yok)
// - Ortada CEVAP ANAHTARI ve ÖĞRENCİ CEVABI satırları: büyük harf doğru, küçük harf yanlış, boşluk işaretlenmemiş
// - Altta KONU ADI · SS · D · Y · % kazanım tablosu (ders başlıkları altında, üç sütun hâlinde)
// Kazanımlar soru soru verilmez; öğrencilerin cevaplarıyla tutarlı soru → konu eşlemesi assignTopics ile bulunur.

type Row = { y: number; items: PdfItem[] };

const norm = (s: string) => s.toLocaleUpperCase("tr-TR").replace(/[^A-ZÇĞİÖŞÜ0-9]/g, "");
const num = (s: string) => {
  const v = Number(s.replace(/\./g, "").replace(",", ".").replace("%", "").trim());
  return Number.isFinite(v) ? v : null;
};

function rowsOf(items: PdfItem[], tolerance = 1.6): Row[] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => b.y - a.y);
  const rows: Row[] = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

const textOf = (r: Row) => r.items.map((i) => i.str).join(" ");
const findRow = (rows: Row[], label: RegExp) => rows.find((r) => r.items.some((i) => label.test(i.str.trim())));

// Cevap bloklarının adları → DERSLER tablosundaki sütun adı (normalize)
const BLOCK_TO_COLUMN: Record<string, string> = {
  TÜRKÇE: "TÜRKÇE",
  SOSYAL: "SOSYAL",
  TMAT: "TMAT",
  FEN: "FEN",
  MATCEVANAH: "MAT1",
  GEO: "GEO1",
  FİZCEVANAH: "FİZ1",
  KİM: "KİM1",
  BİY: "BİY1",
  TDEDEBİYATI: "EDEB",
  TAR1: "TAR1",
  COĞ1: "COĞ1",
  TARİH: "TAR2",
  COĞ2: "COĞ2",
  FELSEFEGRUBU: "FEL1",
};
// Kazanım tablosundaki ders başlığı → hangi sütunda sayılır (TYT'de alt dersler toplam sütununa girer)
const TOPIC_HEAD: Record<string, string[]> = {
  TÜRKÇE: ["TÜRKÇE"],
  TAR: ["SOSYAL", "TAR1"],
  COĞ: ["SOSYAL", "COĞ1"],
  FEL: ["SOSYAL", "FEL1"],
  DİN: ["SOSYAL", "DİNSFEL"],
  SFEL: ["SOSYAL", "DİNSFEL"],
  TMAT: ["TMAT"],
  MAT: ["MAT1", "TMAT"],
  GEO: ["TMAT", "GEO1"],
  FİZ: ["FEN", "FİZ1"],
  KİM: ["FEN", "KİM1"],
  BİY: ["FEN", "BİY1"],
  EDEB: ["EDEB"],
  TAR2: ["TAR2"],
  COĞ2: ["COĞ2"],
};
const NICE: Record<string, string> = { TÜRKÇE: "Türkçe", SOSYAL: "Sosyal Bilimler", TMAT: "Temel Matematik", FEN: "Fen Bilimleri", MAT1: "Matematik", GEO1: "Geometri", FİZ1: "Fizik", KİM1: "Kimya", BİY1: "Biyoloji", EDEB: "Türk Dili ve Edebiyatı", TAR1: "Tarih-1", COĞ1: "Coğrafya-1", TAR2: "Tarih-2", COĞ2: "Coğrafya-2", FEL1: "Felsefe", DİNSFEL: "Din Kültürü / Seçmeli Felsefe", YDİL: "Yabancı Dil" };

/** Harfleri sayfadaki konumlarıyla verir (öğe genişliği harf sayısına bölünür) */
function lettersOf(items: PdfItem[]) {
  const out: { x: number; ch: string }[] = [];
  for (const it of items) {
    const s = it.str;
    for (let i = 0; i < s.length; i++) if (/[A-Ea-eX]/.test(s[i])) out.push({ x: it.x + (it.w * (i + 0.5)) / s.length, ch: s[i] });
  }
  return out.sort((a, b) => a.x - b.x);
}

type PageSection = { col: string; questionCount: number; correct: number; wrong: number; net: number; key: string | null; answers: string | null; topics: { name: string; s: number; d: number; y: number }[] };
type PageData = { examName: string; institution: string; student: Omit<PdfStudent, "sections">; sections: PageSection[] };

export function parseAkbimPage(items: PdfItem[]): PageData | null {
  const rows = rowsOf(items);
  const all = rows.map(textOf).join("\n");
  if (!/SONUÇ BELGESİ/.test(all) || !/SORU SAYISI/.test(all) || !/DERSLER/.test(all)) return null;

  // Künye
  const head = findRow(rows, /^SINAV ADI$/);
  const values = head ? rows.find((r) => r.y < head.y && head.y - r.y < 20 && r !== head) : null;
  const xOf = (re: RegExp) => head?.items.find((i) => re.test(i.str))?.x ?? null;
  const nameX = xOf(/SOYADI/) ?? 200;
  const examX = xOf(/SINAV ADI/) ?? 400;
  const dateX = xOf(/TARİH/) ?? 540;
  const pick = (from: number, to: number) => (values?.items.filter((i) => i.x >= from && i.x < to).map((i) => i.str.trim()).join(" ") ?? "").trim();
  const noX = xOf(/ÖĞR\.?NO/) ?? 85;
  const tcX = xOf(/TC NO/) ?? 126;
  const subeX = xOf(/ŞUBE/) ?? 65;
  const examName = pick(examX - 40, dateX - 12) || "Deneme";
  const name = pick(nameX - 15, examX - 40);
  const number = pick(noX - 3, tcX - 3).replace(/^0+(?=\d)/, "");
  const className = pick(subeX - 3, noX - 3).replace(/^0$/, "");
  const institution = (rows.find((r) => /\/.+\//.test(textOf(r)))?.items.find((i) => /\//.test(i.str))?.str ?? "").split("/").pop()?.replace(/SINAV SONUÇ BELGESİ/, "").trim() ?? "";

  // DERSLER tablosu
  const header = findRow(rows, /^SINAV NET ORT|^DERSLER$/) && rows.find((r) => r.items.filter((i) => /^[A-ZÇĞİÖŞÜ.\- /]+$/.test(i.str.trim())).length >= 4 && r.items.some((i) => /TÜRKÇE/.test(i.str)) && rows.some((x) => /SORU SAYISI/.test(textOf(x)) && x.y < r.y && r.y - x.y < 20));
  if (!header) return null;
  const cols = header.items.filter((i) => i.str.trim() && !/DERSLER/.test(i.str)).map((i) => ({ x: i.x + i.w / 2, col: norm(i.str) }));
  const valueRow = (label: RegExp) => {
    const lab = findRow(rows, label);
    if (!lab) return null;
    const r = rows.find((x) => x.items.some((i) => i.x > 60) && Math.abs(x.y - lab.y) <= 2 && x.items.some((i) => num(i.str) !== null)) ?? lab;
    return cols.map((c) => {
      const it = r.items.filter((i) => num(i.str) !== null && i.x > 60).sort((a, b) => Math.abs(a.x + a.w / 2 - c.x) - Math.abs(b.x + b.w / 2 - c.x))[0];
      return it && Math.abs(it.x + it.w / 2 - c.x) < 14 ? num(it.str) : null;
    });
  };
  const ss = valueRow(/^SORU SAYISI$/);
  const dc = valueRow(/^DOĞRU CEVAP$/);
  const yc = valueRow(/^YANLIŞ CEVAP$/);
  const nt = valueRow(/^NET$/);
  if (!ss || !dc || !yc || !nt) return null;
  const sections: PageSection[] = [];
  cols.forEach((c, i) => {
    const q = ss[i] ?? 0;
    if (q > 0) sections.push({ col: c.col, questionCount: q, correct: dc[i] ?? 0, wrong: yc[i] ?? 0, net: nt[i] ?? 0, key: null, answers: null, topics: [] });
  });
  if (!sections.length) return null;

  // Puan: PUANLAR'ın üstündeki başlıklardan ilk sıfır olmayan değer
  let score: number | null = null;
  const puan = findRow(rows, /^PUANLAR$/);
  if (puan) {
    const vr = rows.find((r) => r.y < puan.y && puan.y - r.y < 10 && r.items.some((i) => /\d+,\d+/.test(i.str) && i.x < 260));
    const v = vr?.items.filter((i) => i.x < 260).map((i) => num(i.str)).find((n) => n !== null && n > 0);
    score = v ?? null;
  }
  // Dereceler (Türkiye, il, ilçe, kurum, şube): sıra 0 ise yazılmaz
  const ranks: PdfStudent["ranks"] = [];
  for (const label of ["TÜRKİYE", "İL", "İLÇE", "KURUM", "ŞUBE"]) {
    const r = rows.find((x) => x.items.some((i) => i.str.trim() === label && i.x < 60));
    if (!r) continue;
    const rank = r.items.filter((i) => i.x > 60 && i.x < 200).map((i) => num(i.str)).find((n) => n !== null) ?? null;
    const of = r.items.filter((i) => i.x > 250 && i.x < 300).map((i) => num(i.str)).find((n) => n !== null) ?? null;
    if (rank && rank > 0) ranks.push({ label: label === "TÜRKİYE" ? "Türkiye" : label === "İL" ? "İl" : label === "İLÇE" ? "İlçe" : label === "KURUM" ? "Kurum" : "Şube", rank, of: of && of > 0 ? of : null });
  }

  // Cevaplar: blok başlığı (sol x<60, sağ 330-350) ve aynı satırdaki anahtar; altındaki "ÖĞRENCİ CEVABI" satırı
  const keyRows = rows.filter((r) => r.items.some((i) => /^[A-E]( [A-E])+$/.test(i.str.trim())));
  for (const kr of keyRows) {
    const sides: { from: number; to: number }[] = [
      { from: 60, to: 325 },
      { from: 345, to: 600 },
    ];
    for (const side of sides) {
      const keyItems = kr.items.filter((i) => i.x >= side.from && i.x < side.to && /^[A-EX ]+$/.test(i.str.trim()));
      if (!keyItems.length) continue;
      // Blok adı: aynı yükseklikte (±2) solda ya da 330 civarında yazan etiket
      const labelItem = rows
        .filter((r) => Math.abs(r.y - kr.y) <= 2.5)
        .flatMap((r) => r.items)
        .find((i) => (side.from === 60 ? i.x < 60 : i.x >= 325 && i.x < 345) && /[A-ZÇĞİÖŞÜ]/.test(i.str) && !/^[A-E]( [A-E])+$/.test(i.str.trim()));
      if (!labelItem) continue;
      const col = BLOCK_TO_COLUMN[norm(labelItem.str)];
      const section = sections.find((s) => s.col === col);
      if (!section) continue;
      const keyLetters = lettersOf(keyItems);
      const fullKey = keyLetters.map((l) => l.ch.toUpperCase()).join("");
      if (fullKey.length < section.questionCount) continue;
      // Anahtar soru sayısından uzunsa sondaki fazlalık seçmeli (alternatif) sorulardır (ör. TYT Sosyal: Din ya da seçmeli Felsefe)
      section.key = fullKey.slice(0, section.questionCount);
      // Öğrenci satırı: anahtarın hemen altındaki ilk satır
      const sr = rows.find((r) => r.y < kr.y && kr.y - r.y < 12 && r.items.some((i) => i.x >= side.from && i.x < side.to && /[A-Ea-e]/.test(i.str) && !/CEVABI/.test(i.str)));
      const slots = new Array<string>(fullKey.length).fill("-");
      const nearestSlot = (x: number) => {
        let best = 0;
        keyLetters.forEach((k, idx) => {
          if (Math.abs(k.x - x) < Math.abs(keyLetters[best].x - x)) best = idx;
        });
        return best;
      };
      const studentItems = sr ? sr.items.filter((i) => i.x >= side.from && i.x < side.to && /^[A-Ea-eX ]+$/.test(i.str.trim()) && !/[A-ZÇĞİÖŞÜ]{2,}/.test(i.str.replace(/[A-E]/g, ""))) : [];
      // Harfler arasındaki boşluklar düzensizdir; bir parçanın kapladığı soru sütunları başlangıç ve bitiş konumundan bulunur.
      // Harf sayısı kapladığı sütun sayısına eşitse harfler sırayla o sütunlara yazılır (boş sorular parçalar arasındaki boşluktadır).
      const pitch = keyLetters.length > 1 ? (keyLetters[keyLetters.length - 1].x - keyLetters[0].x) / (keyLetters.length - 1) : 5;
      for (const it of studentItems) {
        const letters = [...it.str].filter((ch) => /[A-Ea-eX]/.test(ch));
        if (!letters.length) continue;
        const start = nearestSlot(it.x + pitch * 0.4);
        const end = nearestSlot(it.x + it.w - pitch * 0.4);
        if (end - start + 1 === letters.length) {
          letters.forEach((ch, k) => (slots[start + k] = ch.toUpperCase()));
        } else {
          // Yedek: harfin parçadaki doğrusal konumu
          for (const l of lettersOf([it])) slots[nearestSlot(l.x)] = l.ch.toUpperCase();
        }
      }
      const extraMarked = slots.slice(section.questionCount).some((x) => x !== "-");
      const answers = slots.slice(0, section.questionCount).join("");
      const g = gradeAnswers(section.key, answers);
      // Seçmeli soruları çözen öğrenci (başka anahtar) ya da tabloyla tutmayan okuma: cevaplar kullanılmaz
      section.answers = !extraMarked && g.correct === section.correct && g.wrong === section.wrong ? answers : null;
    }
  }

  // Kazanım tablosu
  const topHeader = rows.find((r) => r.items.filter((i) => i.str.trim() === "SS").length >= 2);
  if (topHeader) {
    const groups = topHeader.items.filter((i) => i.str.trim() === "SS").map((ssItem) => {
      const d = topHeader.items.find((i) => i.str.trim() === "D" && i.x > ssItem.x && i.x - ssItem.x < 20);
      const y = topHeader.items.find((i) => i.str.trim() === "Y" && i.x > ssItem.x && i.x - ssItem.x < 35);
      return { ss: ssItem.x, d: d?.x ?? ssItem.x + 12, y: y?.x ?? ssItem.x + 24 };
    });
    const bounds = groups.map((g, i) => ({ ...g, from: i === 0 ? 0 : groups[i - 1].ss + 40, to: g.ss - 2 }));
    for (const g of bounds) {
      let current: string[] | null = null;
      for (const r of rows.filter((x) => x.y < topHeader.y)) {
        const inGroup = r.items.filter((i) => i.x >= g.from && i.x < g.ss + 40);
        if (!inGroup.length) continue;
        const nameItems = inGroup.filter((i) => i.x < g.to && num(i.str) === null);
        const numbers = inGroup.filter((i) => i.x >= g.to - 4);
        const at = (x: number) => num(numbers.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]?.str ?? "");
        const name = nameItems.map((i) => i.str.trim()).join(" ").trim();
        if (!name) continue;
        if (!numbers.length) {
          const headKey = norm(name);
          const targets = TOPIC_HEAD[headKey] ?? [headKey];
          current = targets;
          continue;
        }
        if (!current || /AKBİM|KOÇ/.test(name)) continue;
        const s = at(g.ss + 3);
        const d = at(g.d + 2);
        const y = at(g.y + 2);
        if (s === null || d === null || y === null || s <= 0) continue;
        const section = current.map((c) => sections.find((x) => x.col === c)).find(Boolean);
        if (section) section.topics.push({ name, s, d, y });
      }
    }
  }

  return { examName, institution, student: { name, number, className, score, ranks }, sections };
}

/** Başka kitapçığın cevaplarını asıl kitapçık sırasına çevirir (soru kaydırması tek ve kesinse) */
function canonicalAnswers(x: { key: string | null; answers: string | null }, canonical: string | null): string | null {
  if (!x.answers || !x.key || !canonical) return null;
  if (x.key === canonical) return x.answers;
  const shift = bookletShift(x.key, canonical);
  if (shift === null) return null;
  const n = x.answers.length;
  const out = new Array<string>(n);
  for (let i = 0; i < n; i++) out[(i + shift) % n] = x.answers[i];
  return out.join("");
}

/** Akbim ODS sonuç belgeleri; tanınmazsa boş liste. */
export function parseAkbimPdf(pages: PdfItem[][]): PdfExam[] {
  const parsed = pages.map(parseAkbimPage).filter((p): p is PageData => Boolean(p));
  if (!parsed.length) return [];
  const groups = new Map<string, PageData[]>();
  for (const p of parsed) groups.set(p.examName, [...(groups.get(p.examName) ?? []), p]);

  const exams: PdfExam[] = [];
  for (const [name, list] of groups) {
    // Ders yapısı: en sık görülen sütun dizisi
    const shapeOf = (p: PageData) => p.sections.map((s) => `${s.col}#${s.questionCount}`).join("|");
    const tally = new Map<string, number>();
    list.forEach((p) => tally.set(shapeOf(p), (tally.get(shapeOf(p)) ?? 0) + 1));
    const shape = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const base = list.find((p) => shapeOf(p) === shape)!;
    const kind = detectKind(name, base.sections.map((s) => s.questionCount));
    const preset = EXAM_PRESETS[kind];
    const sectionOf = (p: PageData, i: number) => p.sections.find((s) => s.col === base.sections[i].col) ?? null;

    const sections: PdfExamSection[] = base.sections.map((s, i) => {
      const keys = list.map((p) => sectionOf(p, i)?.key).filter((k): k is string => Boolean(k) && k!.length === s.questionCount);
      const keyTally = new Map<string, number>();
      keys.forEach((k) => keyTally.set(k, (keyTally.get(k) ?? 0) + 1));
      // Kitapçık farkı: en sık anahtar esas; başka anahtarlı öğrencinin cevapları konu eşlemesine katılmaz
      const answerKey = [...keyTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      let topics: string[] = [];
      const withTopics = list.map((p) => sectionOf(p, i)).filter((x): x is PageSection => Boolean(x?.topics.length));
      if (withTopics.length) {
        const listKey = (x: PageSection) => x.topics.map((t) => `${t.name}#${t.s}`).join("|");
        const lt = new Map<string, number>();
        withTopics.forEach((x) => lt.set(listKey(x), (lt.get(listKey(x)) ?? 0) + 1));
        const common = [...lt.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const sample = withTopics.find((x) => listKey(x) === common)!;
        const students = answerKey
          ? withTopics.flatMap((x) => {
              const answers = listKey(x) === common ? canonicalAnswers(x, answerKey) : null;
              return answers ? [{ outcomes: gradeAnswers(answerKey, answers).outcomes as QuestionOutcome[], d: x.topics.map((t) => t.d), y: x.topics.map((t) => t.y) }] : [];
            })
          : [];
        topics = (students.length ? assignTopics(s.questionCount, { names: sample.topics.map((t) => t.name), sizes: sample.topics.map((t) => t.s), students }) : null) ?? [];
      }
      const presetSection = kind !== "CUSTOM" ? preset.sections[i] : null;
      const nice = NICE[s.col] ?? s.col;
      return { label: nice, name: presetSection?.name ?? nice, questionCount: s.questionCount, answerKey, topics, subjectSlug: presetSection?.subjectSlug ?? guessSubject(nice) };
    });

    const penalty = inferPenalty(list.flatMap((p) => p.sections)) ?? preset.wrongPenalty;
    exams.push({
      name,
      institution: base.institution,
      kind,
      wrongPenalty: penalty,
      sections,
      students: list.map((p) => ({
        ...p.student,
        sections: base.sections.map((_, i) => {
          const x = sectionOf(p, i);
          return x ? { correct: x.correct, wrong: x.wrong, net: x.net, answers: canonicalAnswers(x, sections[i].answerKey) } : null;
        }),
      })),
      notes: sections.some((s) => s.topics.length) ? [] : ["Kazanım tablosu okundu ama sorulara eşlenemedi; konu analizi için cevap anahtarını kontrol edin."],
    });
  }
  return exams;
}

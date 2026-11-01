import { EXAM_PRESETS, PENALTY_OPTIONS, type ExamKindName, type QuestionOutcome } from "./exams";

// Yayınevi sonuç PDF'i okuyucu. Sonuç sistemlerinin öğrenci başına "Sonuç Belgesi" sayfalarından deneme adını,
// dersleri, cevap anahtarını, öğrencinin cevaplarını, puanını, sıralamalarını ve kazanım tablosunu çıkarır.
// Girdi: sayfa başına konumlu metin parçaları (PDF koordinatı: y yukarı doğru artar).

export type PdfItem = { x: number; y: number; w: number; str: string };

export type ExternalRank = { label: string; rank: number; of: number | null };

export type PdfStudentSection = { correct: number; wrong: number; net: number; answers: string | null };

export type PdfStudent = {
  name: string;
  number: string;
  className: string;
  score: number | null;
  ranks: ExternalRank[];
  /** Denemenin ders sırasıyla; öğrencinin girmediği ders null */
  sections: (PdfStudentSection | null)[];
};

export type PdfExamSection = { label: string; name: string; questionCount: number; answerKey: string | null; topics: string[]; subjectSlug: string | null };

export type PdfExam = {
  name: string;
  institution: string;
  kind: ExamKindName;
  wrongPenalty: number;
  sections: PdfExamSection[];
  students: PdfStudent[];
};

export type PdfParseResult = { exams: PdfExam[]; pages: number; skippedPages: number };

type Row = { y: number; items: PdfItem[] };

const norm = (s: string) => s.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();

function toRows(items: PdfItem[], tolerance = 2.5): Row[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  for (const item of sorted) {
    const last = rows.at(-1);
    if (last && Math.abs(last.y - item.y) <= tolerance) last.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

const rowText = (row: Row) => row.items.map((i) => i.str.trim()).join(" ");
const has = (row: Row, word: string) => row.items.some((i) => norm(i.str) === norm(word));
const findItem = (row: Row, word: string) => row.items.find((i) => norm(i.str) === norm(word));
const center = (i: PdfItem) => i.x + i.w / 2;

function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Başlık sütunlarına en yakın sayıyı eşler (sağa ya da sola yaslı sayılar için orta noktadan). */
function pickColumns(items: PdfItem[], columns: { key: string; x: number }[], maxDistance = 14): Record<string, number | null> {
  const out: Record<string, number | null> = Object.fromEntries(columns.map((c) => [c.key, null]));
  for (const item of items) {
    const value = parseNumber(item.str);
    if (value === null) continue;
    let best: { key: string; d: number } | null = null;
    for (const c of columns) {
      const d = Math.abs(center(item) - c.x);
      if (d <= maxDistance && (!best || d < best.d)) best = { key: c.key, d };
    }
    if (best && out[best.key] === null) out[best.key] = value;
  }
  return out;
}

type PageSection = { label: string; name: string; questionCount: number; correct: number; wrong: number; net: number; answers: string | null; key: string | null; booklet: string; topics: { name: string; s: number; d: number; y: number }[] };

type ParsedPage = { examName: string; institution: string; student: PdfStudent; sections: PageSection[] };

/** Öğrencinin cevap satırı: büyük harf doğru, küçük harf yanlış, boşluk boş soru. Konumdan soru sırası bulunur. */
function placeAnswers(items: PdfItem[], x0: number, cw: number, length: number, forKey: boolean): string {
  const chars: string[] = Array.from({ length }, () => (forKey ? "X" : "-"));
  for (const item of items) {
    const start = Math.round((item.x - x0) / cw);
    [...item.str].forEach((ch, i) => {
      const at = start + i;
      if (at < 0 || at >= length || ch === " ") return;
      const up = ch.toLocaleUpperCase("en-US");
      chars[at] = "ABCDE".includes(up) ? up : forKey ? "X" : "-";
    });
  }
  return chars.join("");
}

function parseStudentPage(items: PdfItem[]): ParsedPage | null {
  const titleItem = items.find((i) => norm(i.str) === "SONUÇ BELGESİ");
  if (!titleItem) return null;
  const mid = Math.max(titleItem.x + titleItem.w + 20, 290);
  const left = toRows(items.filter((i) => i.x < mid && i !== titleItem));
  const right = toRows(items.filter((i) => i.x >= mid));
  const examName = items
    .filter((i) => i !== titleItem && Math.abs(i.y - titleItem.y) <= 4 && i.x > titleItem.x)
    .sort((a, b) => a.x - b.x)
    .map((i) => i.str.trim())
    .join(" ")
    .trim();
  if (!examName) return null;
  const institution = left.find((r) => r.y < titleItem.y && rowText(r).includes("/"))?.items.map((i) => i.str.trim()).join(" ") ?? "";

  // Öğrenci bilgisi
  const headerIndex = left.findIndex((r) => has(r, "Öğrenci") && has(r, "Numara"));
  if (headerIndex < 0) return null;
  const numberHeader = findItem(left[headerIndex], "Numara")!;
  const classHeader = findItem(left[headerIndex], "Sınıf");
  const infoRow = left[headerIndex + 1];
  const name = infoRow.items.filter((i) => i.x + i.w < numberHeader.x - 2).map((i) => i.str.trim()).join(" ").replace(/\s+/g, " ").trim();
  const number = infoRow.items.find((i) => Math.abs(center(i) - center(numberHeader)) < 25)?.str.trim() ?? "";
  const className = classHeader ? (infoRow.items.find((i) => Math.abs(center(i) - center(classHeader)) < 20 && i.x > numberHeader.x + numberHeader.w)?.str.trim() ?? "") : "";

  // Puan ve sıralamalar
  let score: number | null = null;
  const ranks: ExternalRank[] = [];
  const rankHeaderIndex = left.findIndex((r) => has(r, "Kurum") && has(r, "Genel") && (has(r, "Snf") || has(r, "Sınıf")));
  if (rankHeaderIndex >= 0) {
    const header = left[rankHeaderIndex];
    const labels: { key: string; label: string }[] = [
      { key: "Snf", label: "Sınıf" },
      { key: "Sınıf", label: "Sınıf" },
      { key: "Kurum", label: "Kurum" },
      { key: "İlçe", label: "İlçe" },
      { key: "İl", label: "İl" },
      { key: "Genel", label: "Genel" },
    ];
    const columns = labels.flatMap((l) => {
      const item = header.items.filter((i) => norm(i.str) === norm(l.key)).at(-1);
      return item ? [{ key: l.label, x: center(item) }] : [];
    });
    const below = left.slice(rankHeaderIndex + 1, rankHeaderIndex + 6);
    const scoreRow = below.find((r) => r.items.length >= 3 && parseNumber(r.items[0].str) === null && !/katılım/i.test(r.items[0].str));
    const countRow = below.find((r) => /katılım/i.test(r.items[0].str));
    if (scoreRow) {
      const firstRankX = Math.min(...columns.map((c) => c.x)) - 10;
      score = scoreRow.items.map((i) => (center(i) < firstRankX ? parseNumber(i.str) : null)).find((v) => v !== null) ?? null;
      const rankValues = pickColumns(scoreRow.items.filter((i) => center(i) >= firstRankX), columns);
      const countValues = countRow ? pickColumns(countRow.items.slice(1), columns) : {};
      for (const c of columns) {
        const rank = rankValues[c.key];
        if (rank !== null && rank > 0 && !ranks.some((r) => r.label === c.key)) ranks.push({ label: c.key, rank, of: countValues[c.key] ?? null });
      }
    }
  }

  // Ders tablosu
  const tableIndex = left.findIndex((r) => has(r, "Soru") && has(r, "Doğru") && has(r, "Yanlış") && has(r, "Net"));
  if (tableIndex < 0) return null;
  const th = left[tableIndex];
  const soru = findItem(th, "Soru")!;
  const cols = [
    { key: "q", x: center(soru) },
    { key: "d", x: center(findItem(th, "Doğru")!) },
    { key: "y", x: center(findItem(th, "Yanlış")!) },
    { key: "n", x: center(findItem(th, "Net")!) },
  ];
  const sections: PageSection[] = [];
  for (const row of left.slice(tableIndex + 1)) {
    if (/^toplam/i.test(rowText(row))) break;
    const label = row.items.filter((i) => i.x + i.w < soru.x - 2).map((i) => i.str.trim()).join(" ").trim();
    if (!label) continue;
    const v = pickColumns(row.items.filter((i) => i.x >= soru.x - 6), cols);
    if (v.q === null || v.d === null) continue;
    sections.push({ label: "", name: label, questionCount: v.q, correct: v.d, wrong: v.y ?? 0, net: v.n ?? v.d, answers: null, key: null, booklet: "", topics: [] });
  }
  if (!sections.length) return null;

  // Cevaplar ve anahtar: "Soru No" satırı karakter konumlarını verir.
  const soruNoIndex = left.findIndex((r) => norm(rowText(r)).startsWith("SORU NO"));
  if (soruNoIndex >= 0) {
    const numbers = left[soruNoIndex].items.filter((i) => /^\d+$/.test(i.str.trim()) && i.str.trim().length > 3);
    const ref = numbers[0];
    if (ref) {
      const x0 = ref.x;
      const cw = ref.w / ref.str.trim().length;
      let s = 0;
      const tail = left.slice(soruNoIndex + 1);
      for (let i = 0; i < tail.length - 1 && s < sections.length; i++) {
        const row = tail[i];
        const next = tail[i + 1];
        if (!norm(rowText(next)).startsWith("CEVAP ANH")) continue;
        const section = sections[s++];
        const answerItems = row.items.filter((it) => it.x >= x0 - cw / 2);
        const keyItems = next.items.filter((it) => it.x >= x0 - cw / 2);
        section.label = row.items.filter((it) => it.x < x0 - cw / 2).map((it) => it.str.trim()).join(" ");
        // "Cevap Anh. A": kitapçık türü
        section.booklet = next.items.filter((it) => it.x < x0 - cw / 2 && /^[A-Z]$/.test(it.str.trim())).map((it) => it.str.trim()).join("");
        section.key = placeAnswers(keyItems, x0, cw, section.questionCount, true);
        section.answers = placeAnswers(answerItems, x0, cw, section.questionCount, false);
        i++;
      }
    }
  }

  // Kazanım tablosu (sağ sütun): bölüm başlığı, "S D Y B%" başlığı, sonra kazanım satırları.
  let current: PageSection | null = null;
  let sdy: { s: number; d: number; y: number } | null = null;
  let pending = "";
  for (const row of right) {
    const text = rowText(row);
    const bySection = sections.find((s) => s.label && norm(s.label) === norm(text));
    if (bySection) {
      current = bySection;
      sdy = null;
      pending = "";
      continue;
    }
    if (has(row, "S") && has(row, "D") && has(row, "Y")) {
      sdy = { s: center(findItem(row, "S")!), d: center(findItem(row, "D")!), y: center(findItem(row, "Y")!) };
      continue;
    }
    if (!current || !sdy) continue;
    const numberStart = sdy.s - 6;
    const words = row.items.filter((i) => i.x < numberStart || parseNumber(i.str) === null).map((i) => i.str.trim()).join(" ");
    const v = pickColumns(
      row.items.filter((i) => i.x >= numberStart),
      [
        { key: "s", x: sdy.s },
        { key: "d", x: sdy.d },
        { key: "y", x: sdy.y },
      ],
      3.5,
    );
    if (v.s === null) {
      pending = `${pending} ${words}`.trim();
      continue;
    }
    const topic = `${pending} ${words}`.replace(/\s+/g, " ").trim();
    pending = "";
    if (topic) current.topics.push({ name: topic, s: v.s, d: v.d ?? 0, y: v.y ?? 0 });
  }

  return { examName, institution, student: { name, number, className, score, ranks, sections: [] }, sections };
}

function outcomesOf(key: string, answers: string): QuestionOutcome[] {
  return [...key].map((k, i) => (k === "X" ? "C" : answers[i] === "-" ? "B" : answers[i] === k ? "C" : "W"));
}

type TopicConstraint = { names: string[]; sizes: number[]; students: { outcomes: QuestionOutcome[]; d: number[]; y: number[] }[] };

/**
 * Soru → kazanım eşlemesi. PDF yalnızca öğrenci başına kazanım özetini (soru, doğru, yanlış) veriyor;
 * tüm öğrencilerin cevaplarıyla tutarlı tek atamayı geri izlemeyle bulur. Kazanımlar genelde ilk göründükleri
 * soru sırasıyla listelenir; önce bu varsayımla, olmazsa serbest aranır. Bulunamazsa null.
 */
export function assignTopics(questionCount: number, c: TopicConstraint, maxNodes = 200_000): string[] | null {
  const K = c.sizes.length;
  if (!K || c.sizes.reduce((a, b) => a + b, 0) !== questionCount) return null;
  const run = (ordered: boolean): string[] | null => {
    const used = new Array(K).fill(0);
    const cs = c.students.map(() => new Array(K).fill(0));
    const ws = c.students.map(() => new Array(K).fill(0));
    const assign: number[] = [];
    let opened = 0;
    let nodes = 0;
    const fits = (q: number, k: number) => {
      const closing = used[k] + 1 === c.sizes[k];
      return c.students.every((st, si) => {
        const o = st.outcomes[q];
        const cc = cs[si][k] + (o === "C" ? 1 : 0);
        const ww = ws[si][k] + (o === "W" ? 1 : 0);
        if (cc > st.d[k] || ww > st.y[k]) return false;
        return !closing || (cc === st.d[k] && ww === st.y[k]);
      });
    };
    const apply = (q: number, k: number, sign: 1 | -1) => {
      used[k] += sign;
      c.students.forEach((st, si) => {
        if (st.outcomes[q] === "C") cs[si][k] += sign;
        else if (st.outcomes[q] === "W") ws[si][k] += sign;
      });
    };
    const step = (q: number): boolean => {
      if (q === questionCount) return true;
      if (++nodes > maxNodes) return false;
      const candidates: number[] = [];
      if (ordered) {
        const last = assign.at(-1);
        if (last !== undefined && used[last] < c.sizes[last]) candidates.push(last);
        if (opened < K) candidates.push(opened);
        for (let k = opened - 1; k >= 0; k--) if (k !== last && used[k] < c.sizes[k]) candidates.push(k);
      } else {
        for (let k = 0; k < K; k++) if (used[k] < c.sizes[k]) candidates.push(k);
      }
      for (const k of candidates) {
        if (!fits(q, k)) continue;
        const wasOpened = opened;
        if (ordered && k === opened) opened++;
        apply(q, k, 1);
        assign.push(k);
        if (step(q + 1)) return true;
        assign.pop();
        apply(q, k, -1);
        opened = wasOpened;
      }
      return false;
    };
    return step(0) ? assign.map((k) => c.names[k]) : null;
  };
  return run(true) ?? run(false);
}

function inferPenalty(rows: { correct: number; wrong: number; net: number }[]): number | null {
  const samples = rows.filter((r) => r.wrong > 0).map((r) => (r.correct - r.net) / r.wrong);
  if (!samples.length) return null;
  const options = PENALTY_OPTIONS.map((p) => p.penalty);
  const score = (p: number) => samples.filter((s) => Math.abs(s - p) < 0.02).length;
  return options.reduce((best, p) => (score(p) > score(best) ? p : best), options[0]);
}

const SUBJECT_GUESS: [RegExp, string][] = [
  [/T[ÜU]RK[ÇC]E|EDEB/, "turkce"],
  [/MATEMAT/, "matematik"],
  [/GEOMETR/, "geometri"],
  [/FEN/, "fen-bilimleri"],
  [/FİZİK|FIZIK/, "fizik"],
  [/KİMYA|KIMYA/, "kimya"],
  [/BİYOLOJ|BIYOLOJ/, "biyoloji"],
  [/İNKILAP|INKILAP|^TARİH|^TARIH|T\.C\./, "inkilap-tarihi"],
  [/D[İI]N/, "din-kulturu"],
  [/İNGİLİZCE|INGILIZCE|YABANCI/, "ingilizce"],
  [/SOSYAL/, "sosyal-bilgiler"],
];

function guessSubject(name: string): string | null {
  const n = norm(name);
  return SUBJECT_GUESS.find(([re]) => re.test(n))?.[1] ?? null;
}

/** Ders sayıları bir hazır şablona (LGS, TYT…) uyuyorsa o tür; 5-7. sınıf denemeleri serbest deneme sayılır. */
function detectKind(name: string, counts: number[]): ExamKindName {
  const lowerGrade = /\b[5-7]\s*\.?\s*SINIF/.test(norm(name));
  for (const kind of Object.keys(EXAM_PRESETS) as ExamKindName[]) {
    const preset = EXAM_PRESETS[kind];
    if (kind === "CUSTOM" || preset.sections.length !== counts.length) continue;
    if (preset.sections.every((s, i) => s.questionCount === counts[i])) return kind === "LGS" && lowerGrade ? "CUSTOM" : kind;
  }
  return "CUSTOM";
}

const mostCommon = <T>(values: T[], keyOf: (v: T) => string = String): T | undefined => {
  const tally = new Map<string, { value: T; n: number }>();
  for (const v of values) {
    const k = keyOf(v);
    const entry = tally.get(k) ?? { value: v, n: 0 };
    entry.n++;
    tally.set(k, entry);
  }
  return [...tally.values()].sort((a, b) => b.n - a.n)[0]?.value;
};

/**
 * Başka kitapçıktaki (B) soru sırasını asıl kitapçığa çevirir. Yayınlar kitapçıkları genelde soruları kaydırarak
 * hazırlar; anahtarı birebir tutan tek kaydırma varsa kullanılır, yoksa null (cevaplar konu analizine katılmaz).
 */
export function bookletShift(key: string, canonical: string): number | null {
  if (key.length !== canonical.length) return null;
  const n = key.length;
  const fits: number[] = [];
  for (let shift = 0; shift < n; shift++) {
    if ([...key].every((ch, i) => canonical[(i + shift) % n] === ch)) fits.push(shift);
  }
  return fits.length === 1 ? fits[0] : null;
}

function toCanonical(answers: string, shift: number): string {
  const n = answers.length;
  const out = new Array<string>(n);
  for (let i = 0; i < n; i++) out[(i + shift) % n] = answers[i];
  return out.join("");
}

/** Sayfa sayfa metin parçalarından denemeleri çıkarır. Bir PDF'te birden fazla deneme olabilir. */
export function parseResultPdf(pages: PdfItem[][]): PdfParseResult {
  const groups = new Map<string, ParsedPage[]>();
  let skipped = 0;
  for (const items of pages) {
    const page = parseStudentPage(items);
    if (!page) {
      skipped++;
      continue;
    }
    const list = groups.get(page.examName) ?? [];
    list.push(page);
    groups.set(page.examName, list);
  }

  const exams: PdfExam[] = [];
  for (const [name, list] of groups) {
    // Dersler: en sık görülen ders dizisi (bir dersi boş bırakan öğrencinin sayfasında o ders hiç yazmaz).
    const shape = mostCommon(list.map((p) => p.sections.map((s) => `${s.name}#${s.questionCount}`).join("|")))!;
    const base = list.find((p) => p.sections.map((s) => `${s.name}#${s.questionCount}`).join("|") === shape)!;
    const counts = base.sections.map((s) => s.questionCount);
    const kind = detectKind(name, counts);
    const preset = EXAM_PRESETS[kind];
    const penalty = inferPenalty(list.flatMap((p) => p.sections)) ?? preset.wrongPenalty;
    const sectionOf = (p: ParsedPage, i: number) => p.sections.find((s) => s.name === base.sections[i].name && s.questionCount === base.sections[i].questionCount) ?? null;

    // Her ders için asıl kitapçık (varsa A) ve anahtarı; diğer kitapçıkların cevapları bu sıraya çevrilir.
    const canonical = base.sections.map((_, i) => {
      const own = list.map((p) => sectionOf(p, i)).filter((s): s is PageSection => Boolean(s?.key));
      const booklets = [...new Set(own.map((s) => s.booklet))].sort();
      const booklet = booklets.includes("A") ? "A" : (mostCommon(own.map((s) => s.booklet)) ?? "");
      const key = mostCommon(own.filter((s) => s.booklet === booklet).map((s) => s.key!)) ?? null;
      return { booklet, key };
    });
    const canonicalAnswers = (s: PageSection, i: number): string | null => {
      const { key } = canonical[i];
      if (!s.answers || !s.key || !key) return null;
      if (s.key === key) return s.answers;
      const shift = bookletShift(s.key, key);
      return shift === null ? null : toCanonical(s.answers, shift);
    };

    const sections: PdfExamSection[] = base.sections.map((s, i) => {
      const answerKey = canonical[i].key;
      let topics: string[] = [];
      if (answerKey) {
        // Kazanım listesi öğrenciden bağımsızdır (soru sayısı aynı); en sık görülen liste esas alınır.
        const listKey = (sec: PageSection) => sec.topics.map((t) => `${t.name}#${t.s}`).join("|");
        const withTopics = list.map((p) => sectionOf(p, i)).filter((sec): sec is PageSection => Boolean(sec?.topics.length));
        const common = mostCommon(withTopics.map(listKey));
        const sample = withTopics.find((sec) => listKey(sec) === common);
        if (sample) {
          const students = withTopics.flatMap((sec) => {
            const answers = listKey(sec) === common ? canonicalAnswers(sec, i) : null;
            return answers ? [{ outcomes: outcomesOf(answerKey, answers), d: sec.topics.map((t) => t.d), y: sec.topics.map((t) => t.y) }] : [];
          });
          topics = assignTopics(s.questionCount, { names: sample.topics.map((t) => t.name), sizes: sample.topics.map((t) => t.s), students }) ?? [];
        }
      }
      const presetSection = kind !== "CUSTOM" ? preset.sections[i] : null;
      return {
        label: s.label || s.name,
        name: presetSection?.name ?? s.name,
        questionCount: s.questionCount,
        answerKey,
        topics,
        subjectSlug: presetSection?.subjectSlug ?? guessSubject(s.name),
      };
    });

    exams.push({
      name,
      institution: base.institution,
      kind,
      wrongPenalty: penalty,
      sections,
      students: list.map((p) => ({
        ...p.student,
        sections: base.sections.map((_, i) => {
          const s = sectionOf(p, i);
          return s ? { correct: s.correct, wrong: s.wrong, net: s.net, answers: canonicalAnswers(s, i) } : null;
        }),
      })),
    });
  }
  return { exams, pages: pages.length, skippedPages: skipped };
}

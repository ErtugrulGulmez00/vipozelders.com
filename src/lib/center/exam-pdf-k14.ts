import type { ExternalRank, PdfExam, PdfExamSection, PdfItem, PdfStudent, PdfStudentSection } from "./exam-pdf";
import { detectKind, guessSubject, inferPenalty, presetSectionsFor } from "./exam-pdf";
import { EXAM_PRESETS, gradeAnswers, type QuestionOutcome } from "./exams";

// K14 (k14net) kurum yazılımının deneme çıktıları. Birçok yayının denemesi kurumda bu sistemle okunur.
// 1) "Analizli karne": öğrenci başına bir sayfa. Üstte DERSLER tablosu (S.SAYISI / DOĞRU / YANLIŞ / BOŞ / NET) ve
//    Puan Türü tablosu (puan, şube/okul/kurum/genel sırası); altta ders ders "Sr Ö A D Kazanım Açıklama" satırları:
//    Ö öğrencinin cevabı (küçük harf yanlış, boş işaretlenmemiş), A cevap anahtarı, kazanım soru soru yazılı.
// 2) "Genel sıralı liste": tablo; ders başına D / Y / N sütunları, puan, toplam net, şube/kurum sırası.

type Row = { y: number; items: PdfItem[] };

const up = (s: string) => s.toLocaleUpperCase("tr-TR");
const num = (s: string | undefined) => {
  if (s === undefined) return null;
  const v = Number(s.replace(",", ".").replace("%", "").trim());
  return Number.isFinite(v) ? v : null;
};

function rowsOf(items: PdfItem[], tolerance = 2): Row[] {
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

const pageText = (items: PdfItem[]) => items.map((i) => i.str).join(" ");
export const isK14 = (pages: PdfItem[][]) => pages.slice(0, 3).some((p) => /k14net/i.test(pageText(p)));

// DERSLER tablosundaki (kısaltılmış) adlar → düzgün ad
const NAMES: [RegExp, string][] = [
  [/^TÜRK D/, "Türk Dili ve Edebiyatı"],
  [/^DİN K/, "Din Kültürü ve Ahlak Bilgisi"],
  [/^COĞRAFY?$|^COĞRAFYA$/, "Coğrafya"],
  [/^MATEMAT?$/, "Matematik"],
  [/^GEOMETR?$/, "Geometri"],
  [/^BİYOLOJ?$/, "Biyoloji"],
];
function niceName(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim();
  const hit = NAMES.find(([re]) => re.test(up(name)));
  return hit ? hit[1] : name;
}

// ---------------------------------------------------------------------------
// 1) Analizli karne
// ---------------------------------------------------------------------------

type KarneSection = { name: string; questionCount: number; correct: number; wrong: number; net: number };
type KarneQuestion = { answer: string; key: string; topic: string };
type KarnePage = { examName: string; institution: string; name: string; score: number | null; ranks: ExternalRank[]; scoreType: string | null; sections: KarneSection[]; questions: KarneQuestion[] };

/** Puan Türü tablosu: [{ type, score, ranks }] */
function scoreRows(rows: Row[]) {
  const head = rows.find((r) => r.items.some((i) => i.str.trim() === "Puan Türü"));
  if (!head) return [];
  const col = (label: string) => head.items.find((i) => i.str.trim() === label)?.x;
  const cols = { score: col("Puanı"), Şube: col("Şube"), Okul: col("Okul"), Kurum: col("Kurum Mrk"), Genel: col("Genel") };
  const typeX = head.items.find((i) => i.str.trim() === "Puan Türü")!.x;
  const out: { type: string; score: number; ranks: ExternalRank[] }[] = [];
  for (const r of rows) {
    if (r.y >= head.y || r.y < head.y - 60) continue;
    const label = r.items.find((i) => Math.abs(i.x - typeX) < 6 && /^[A-ZÖÇŞİĞÜ_]{2,}$/.test(i.str.trim()));
    if (!label) continue;
    const at = (x: number | undefined) => (x === undefined ? undefined : r.items.find((i) => i !== label && Math.abs(i.x - x) < 12)?.str);
    const score = num(at(cols.score));
    if (score === null) continue;
    const ranks: ExternalRank[] = [];
    for (const key of ["Şube", "Okul", "Kurum", "Genel"] as const) {
      const v = num(at(cols[key]));
      if (v && v > 0) ranks.push({ label: key, rank: v, of: null });
    }
    out.push({ type: label.str.trim().replace(/_PUAN$/, ""), score, ranks });
  }
  return out;
}

export function parseK14KarnePage(items: PdfItem[]): KarnePage | null {
  const text = pageText(items);
  if (!/DERSLER/.test(text) || !/S\.SAYISI/.test(text) || !/Kazanım Açıklama/.test(text)) return null;
  const rows = rowsOf(items);
  const dersHead = rows.find((r) => r.items.some((i) => i.str.trim() === "DERSLER"));
  if (!dersHead) return null;
  const colX = (label: string) => dersHead.items.find((i) => i.str.trim() === label)?.x ?? null;
  const cx = { count: colX("S.SAYISI"), d: colX("DOĞRU"), y: colX("YANLIŞ"), net: colX("NET") };
  if (cx.count === null || cx.d === null || cx.y === null || cx.net === null) return null;
  // Soru blokları ilk "… dersi / … dersleri" başlığıyla başlar
  const blockTop = Math.max(...items.filter((i) => /(dersi|dersleri)$/.test(i.str.trim())).map((i) => i.y));
  if (!Number.isFinite(blockTop)) return null;

  // DERSLER tablosu (sol taraf)
  const sections: KarneSection[] = [];
  for (const r of rows) {
    if (r.y >= dersHead.y || r.y <= blockTop) continue;
    const left = r.items.filter((i) => i.x < (cx.net ?? 0) + 25);
    const label = left.find((i) => i.x < (cx.count ?? 0) - 10 && /\p{L}/u.test(i.str));
    if (!label) continue;
    const at = (x: number) => left.find((i) => i !== label && Math.abs(i.x + i.w / 2 - x - 4) < 14)?.str;
    const count = num(at(cx.count));
    const d = num(at(cx.d));
    const y = num(at(cx.y));
    const net = num(at(cx.net));
    if (!count || d === null || y === null || net === null) continue;
    sections.push({ name: niceName(label.str), questionCount: count, correct: d, wrong: y, net });
  }
  if (!sections.length) return null;

  // Başlık: deneme adı, kurum, öğrenci adı (aynı x hizasında üst üste)
  const top = rows.filter((r) => r.y > dersHead.y + 20);
  const headX = top[0]?.items[0]?.x ?? 0;
  const headLines = top.map((r) => r.items.filter((i) => Math.abs(i.x - headX) < 4 && /\p{L}/u.test(i.str))).filter((l) => l.length);
  const examName = headLines[0]?.map((i) => i.str).join(" ").trim() ?? "";
  const institution = headLines[1]?.map((i) => i.str).join(" ").trim() ?? "";
  const name = headLines[2]?.map((i) => i.str).join(" ").trim() ?? "";
  if (!examName || !name) return null;

  // Puan: TYT karnesinde TYT, AYT'de en yüksek puan türü
  const scores = scoreRows(rows);
  const best = scores.find((s) => s.type === "TYT") ?? [...scores].sort((a, b) => b.score - a.score)[0];

  // Soru satırları: her sütun bloğunun "Sr Ö A D Kazanım" başlığından konumlar
  const heads = items.filter((i) => i.str.trim() === "Sr" && i.y < blockTop + 5);
  const bases = [...new Set(heads.map((h) => Math.round(h.x)))].sort((a, b) => a - b).filter((x, i, arr) => i === 0 || x - arr[i - 1] > 30);
  const questions: KarneQuestion[] = [];
  for (const [b, base] of bases.entries()) {
    const right = bases[b + 1] ?? Infinity;
    const band = items.filter((i) => i.x >= base - 4 && i.x < right - 4 && i.y < blockTop + 5 && i.y > 25);
    const head = rowsOf(band).find((r) => r.items.some((i) => i.str.trim() === "Sr"));
    const hx = (label: string) => head?.items.find((i) => i.str.trim() === label)?.x;
    const ax = { ans: hx("Ö") ?? base + 12, key: hx("A") ?? base + 20, topic: (hx("Kazanım Açıklama") ?? base + 37) - 3 };
    let last: KarneQuestion | null = null;
    for (const r of rowsOf(band)) {
      const first = r.items[0];
      if (/(dersi|dersleri)$/.test(r.items.map((i) => i.str).join(" ").trim()) || first.str.trim() === "Sr") {
        last = null;
        continue;
      }
      const isNo = Math.abs(first.x - base) < 4 && /^\d{1,3}$/.test(first.str.trim());
      const topic = r.items.filter((i) => i.x >= ax.topic).map((i) => i.str.trim()).join(" ").trim();
      if (!isNo) {
        if (last && topic && r.items.every((i) => i.x >= ax.topic)) last.topic = `${last.topic} ${topic}`.trim();
        continue;
      }
      const letter = (x: number) => r.items.find((i) => Math.abs(i.x - x) < 4 && /^[A-Ea-e]$/.test(i.str.trim()))?.str.trim() ?? null;
      const key = letter(ax.key);
      const answer = letter(ax.ans);
      last = { key: key ? key.toUpperCase() : "X", answer: answer ? answer.toUpperCase() : "-", topic };
      questions.push(last);
    }
  }
  return { examName, institution, name, score: best?.score ?? null, ranks: best?.ranks ?? [], scoreType: best?.type ?? null, sections, questions };
}

/** Öğrencinin kendi kitapçık sırasındaki sonuçlarını asıl sıraya konu konu taşır (A/B kitapçığı); tutmazsa null. */
function reorderByTopic(own: KarneQuestion[], canonical: { key: string; topics: string[] }): string | null {
  const queues = new Map<string, QuestionOutcome[]>();
  for (const q of own) {
    const o: QuestionOutcome = q.key === "X" ? "C" : q.answer === "-" ? "B" : q.answer === q.key ? "C" : "W";
    queues.set(q.topic, [...(queues.get(q.topic) ?? []), o]);
  }
  let out = "";
  for (let i = 0; i < canonical.topics.length; i++) {
    const o = queues.get(canonical.topics[i])?.shift();
    if (!o) return null;
    const k = canonical.key[i];
    out += o === "C" ? (k === "X" ? "A" : k) : o === "B" ? "-" : k === "A" ? "B" : "A";
  }
  return [...queues.values()].every((q) => !q.length) ? out : null;
}

export function parseK14Karne(pages: PdfItem[][]): PdfExam[] {
  const parsed = pages.map(parseK14KarnePage).filter((p): p is KarnePage => Boolean(p));
  if (!parsed.length) return [];
  const groups = new Map<string, KarnePage[]>();
  for (const p of parsed) groups.set(p.examName, [...(groups.get(p.examName) ?? []), p]);
  const exams: PdfExam[] = [];
  for (const [name, list] of groups) {
    const shapeOf = (p: KarnePage) => p.sections.map((s) => `${s.name}#${s.questionCount}`).join("|");
    const tally = new Map<string, number>();
    list.forEach((p) => tally.set(shapeOf(p), (tally.get(shapeOf(p)) ?? 0) + 1));
    const shape = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const base = list.find((p) => shapeOf(p) === shape)!;
    const counts = base.sections.map((s) => s.questionCount);
    // Seçmeli test (TYT'de Din yerine "Felsefe(Seç)"): soru bloğu yalnızca öğrenci o testi seçtiyse basılır
    const optional = base.sections.map((s) => /SEÇ/.test(up(s.name)));
    const din = base.sections.findIndex((s) => /^DİN/.test(up(s.name)));
    const kind = detectKind(name, counts.filter((_, i) => !optional[i]));
    const preset = EXAM_PRESETS[kind];
    const presetNames = presetSectionsFor(kind, counts.filter((_, i) => !optional[i]));
    const ownOf = (p: KarnePage, i: number) => p.sections.find((x) => x.name === base.sections[i].name && x.questionCount === counts[i]) ?? null;
    const marked = (x: KarneSection | null) => Boolean(x && x.correct + x.wrong > 0);
    // Öğrencinin sayfasında bloğu basılan testler
    const layoutOf = (p: KarnePage) => {
      const tookOptional = optional.some((o, i) => o && marked(ownOf(p, i)));
      return counts.map((_, i) => (optional[i] ? marked(ownOf(p, i)) : !(i === din && tookOptional)));
    };
    const fits = (p: KarnePage) => shapeOf(p) === shape && p.questions.length === counts.reduce((t, c, i) => t + (layoutOf(p)[i] ? c : 0), 0);

    // Ders başına soru dilimleri (soru blokları DERSLER sırasıyla art arda gelir)
    const slice = (p: KarnePage, i: number) => {
      const layout = layoutOf(p);
      if (!layout[i]) return [];
      const start = counts.slice(0, i).reduce((t, c, j) => t + (layout[j] ? c : 0), 0);
      return p.questions.slice(start, start + counts[i]);
    };
    const sections: PdfExamSection[] = base.sections.map((s, i) => {
      const keyOf = (p: KarnePage) => slice(p, i).map((q) => q.key).join("");
      const keyTally = new Map<string, { n: number; p: KarnePage }>();
      for (const p of list.filter((p) => fits(p) && layoutOf(p)[i])) {
        const k = keyOf(p);
        const e = keyTally.get(k) ?? { n: 0, p };
        e.n++;
        keyTally.set(k, e);
      }
      const common = [...keyTally.entries()].sort((a, b) => b[1].n - a[1].n)[0];
      const answerKey = common && /[A-E]/.test(common[0]) ? common[0] : null;
      const topics = common ? slice(common[1].p, i).map((q) => q.topic) : [];
      const presetSection = optional[i] ? null : presetNames[optional.slice(0, i).filter((o) => !o).length] ?? null;
      return { label: s.name, name: presetSection?.name ?? s.name, questionCount: s.questionCount, answerKey, topics: topics.some(Boolean) ? topics : [], subjectSlug: presetSection?.subjectSlug ?? guessSubject(s.name) };
    });

    const students: PdfStudent[] = list.map((p) => ({
      name: p.name,
      number: "",
      className: "",
      score: p.score,
      ranks: p.ranks,
      sections: base.sections.map((s, i): PdfStudentSection | null => {
        const own = ownOf(p, i);
        if (!own) return null;
        // AYT'de girilmeyen testler ve seçilmeyen seçmeli test (hiç işaret yok) "girmedi" sayılır
        if ((kind === "AYT" || optional[i] || !layoutOf(p)[i]) && own.correct === 0 && own.wrong === 0) return null;
        let answers: string | null = null;
        const sec = sections[i];
        if (fits(p) && layoutOf(p)[i] && sec.answerKey) {
          const qs = slice(p, i);
          const ownKey = qs.map((q) => q.key).join("");
          answers = ownKey === sec.answerKey ? qs.map((q) => q.answer).join("") : sec.topics.length ? reorderByTopic(qs, { key: sec.answerKey, topics: sec.topics }) : null;
          // Tablodaki doğru/yanlışla tutmayan dizi kullanılmaz
          if (answers) {
            const g = gradeAnswers(sec.answerKey, answers);
            if (g.correct !== own.correct || g.wrong !== own.wrong) answers = null;
          }
        }
        return { correct: own.correct, wrong: own.wrong, net: own.net, answers };
      }),
    }));
    const penalty = inferPenalty(list.flatMap((p) => p.sections)) ?? preset.wrongPenalty;
    exams.push({ name, institution: base.institution, kind, wrongPenalty: penalty, sections, students, notes: [] });
  }
  return exams;
}

// ---------------------------------------------------------------------------
// 2) Genel sıralı liste
// ---------------------------------------------------------------------------

export function parseK14List(pages: PdfItem[][]): PdfExam[] {
  const students: PdfStudent[] = [];
  let header: { name: string; institution: string; sections: { name: string; count: number; d: number; y: number; n: number }[]; score: number | null; sb: number | null; kr: number | null } | null = null;
  for (const items of pages) {
    const text = pageText(items);
    if (!/Sıralı Liste/i.test(text) || !/ADI SOYADI/.test(text)) continue;
    const rows = rowsOf(items);
    const titleRow = rows.find((r) => r.items.some((i) => /\(\d+\)/.test(i.str)));
    const colRow = rows.find((r) => r.items.filter((i) => /^[DYN]$/.test(i.str.trim())).length >= 6);
    const nameHead = rows.find((r) => r.items.some((i) => i.str.trim() === "ADI SOYADI"));
    if (!titleRow || !colRow || !nameHead) continue;
    if (!header) {
      // Başlıklar "Türkçe (40)"; bazen iki başlık tek parça ("Matemat (40) Geometr (0)"). D/Y/N üçlüleri aynı sırada.
      const titles = titleRow.items.flatMap((i) => [...i.str.matchAll(/([^()]+?)\s*\((\d+)\)/g)].map((m) => ({ name: niceName(m[1]), count: Number(m[2]) })));
      const dyn = colRow.items.filter((i) => /^[DYN]$/.test(i.str.trim()));
      const triples: { d: number; y: number; n: number }[] = [];
      for (let k = 0; k + 2 < dyn.length; k++) {
        if (dyn[k].str.trim() === "D" && dyn[k + 1].str.trim() === "Y" && dyn[k + 2].str.trim() === "N") {
          triples.push({ d: dyn[k].x, y: dyn[k + 1].x, n: dyn[k + 2].x });
          k += 2;
        }
      }
      // Sorusu 0 olan başlık (ör. Matematik 40 içinde ayrıca Geometri 0) sütunuyla birlikte atlanır
      const secs = titles.length === triples.length ? titles.flatMap((t, idx) => (t.count > 0 ? [{ ...t, ...triples[idx] }] : [])) : [];
      const at = (label: string) => colRow.items.find((i) => i.str.trim() === label)?.x ?? null;
      // Başlığın üstündeki satırlar: kurum ve deneme adı (sol hizada)
      const above = rows.filter((r) => r.y > titleRow.y + 5).map((r) => r.items.filter((i) => i.x < 200 && /\p{L}/u.test(i.str)).map((i) => i.str).join(" ").trim()).filter(Boolean);
      header = { name: above.find((l) => /TYT|AYT|YKS|LGS|MSÜ|DENEME|TG/i.test(l)) ?? above[above.length - 1] ?? "", institution: above[0] ?? "", sections: secs, score: at("Puan"), sb: at("Sb"), kr: at("Kr") };
    }
    const h = header;
    if (!h.sections.length) continue;
    const nameX = nameHead.items.find((i) => i.str.trim() === "ADI SOYADI")!.x;
    const siraX = nameHead.items.find((i) => i.str.trim() === "Sıra")?.x ?? 10;
    for (const r of rows) {
      if (r.y >= colRow.y) continue;
      const lead = r.items[0];
      if (!/^\d{1,4}$/.test(lead.str.trim()) || lead.x > siraX + 10) continue;
      const nameParts = r.items.filter((i) => i.x >= nameX - 2 && i.x < nameX + 85 && /\p{L}/u.test(i.str));
      if (!nameParts.length) continue;
      const branch = r.items.filter((i) => i.x > lead.x + 5 && i.x < nameX - 2).map((i) => i.str.trim()).join(" ");
      const at = (x: number | null) => (x === null ? null : num(r.items.find((i) => i.x > nameX + 60 && !/\p{L}/u.test(i.str) && Math.abs(i.x + i.w / 2 - x - 4) < 9)?.str));
      const sections = h.sections.map((s): PdfStudentSection | null => {
        const d = at(s.d);
        const y = at(s.y);
        const n = at(s.n);
        return d === null || y === null || n === null ? null : { correct: d, wrong: y, net: n, answers: null };
      });
      if (sections.every((s) => !s)) continue;
      const ranks: ExternalRank[] = [];
      const sb = at(h.sb);
      const kr = at(h.kr);
      if (sb) ranks.push({ label: "Şube", rank: sb, of: null });
      if (kr) ranks.push({ label: "Kurum", rank: kr, of: null });
      students.push({ name: nameParts.map((i) => i.str.trim()).join(" "), number: "", className: branch && branch !== "-" ? branch : "", score: at(h.score), ranks, sections });
    }
  }
  if (!header || !students.length) return [];
  const counts = header.sections.map((s) => s.count);
  const kind = detectKind(header.name, counts);
  const preset = EXAM_PRESETS[kind];
  const presetNames = presetSectionsFor(kind, counts);
  const penalty = inferPenalty(students.flatMap((s) => s.sections.filter((x): x is PdfStudentSection => Boolean(x)))) ?? preset.wrongPenalty;
  return [
    {
      name: header.name,
      institution: header.institution,
      kind,
      wrongPenalty: penalty,
      sections: header.sections.map((s, i) => {
        const p = presetNames[i];
        return { label: s.name, name: p?.name ?? s.name, questionCount: s.count, answerKey: null, topics: [], subjectSlug: p?.subjectSlug ?? guessSubject(s.name) };
      }),
      students: kind === "AYT" ? students.map((st) => ({ ...st, sections: st.sections.map((s) => (s && s.correct === 0 && s.wrong === 0 ? null : s)) })) : students,
      notes: ["Bu liste yalnızca netleri içerir; konu analizi için aynı denemenin “analizli karne” PDF'ini yükleyin."],
    },
  ];
}

/** K14 çıktıları: önce analizli karne, olmazsa sıralı liste. */
export function parseK14Pdf(pages: PdfItem[][]): PdfExam[] {
  if (!isK14(pages) && !pages.slice(0, 2).some((p) => /DERSLER/.test(pageText(p)) && /Kazanım Açıklama/.test(pageText(p))) && !pages.slice(0, 2).some((p) => /Sıralı Liste/i.test(pageText(p)))) return [];
  const karne = parseK14Karne(pages);
  return karne.length ? karne : parseK14List(pages);
}

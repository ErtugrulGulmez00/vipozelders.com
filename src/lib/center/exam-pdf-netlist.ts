import type { ExternalRank, PdfExam, PdfItem, PdfStudent, PdfStudentSection } from "./exam-pdf";
import { detectKind, guessSubject, inferPenalty, presetSectionsFor } from "./exam-pdf";
import { EXAM_PRESETS } from "./exams";

// "OKUL … NET LİSTESİ (TYT sıralı)" (ör. 4K, Krallar Karması TG, Özdebir MSÜ, Apotemi TG): tablo; ders başına D / Y / N,
// toplam, puan ve sınıf/okul/ilçe/il/genel sırası. Soru sayıları yazmaz; TYT (ve MSÜ) ders adlarından bilinir.
// Bazı satırlarda sınıf ile ilk sayı bitişik yazılır ("12-XX33").

type Row = { y: number; items: PdfItem[] };

const up = (s: string) => s.toLocaleUpperCase("tr-TR");
const num = (s: string | undefined) => {
  if (s === undefined) return null;
  const v = Number(s.replace(",", ".").trim());
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

const NET_LIST_COUNTS: [RegExp, string, number, boolean][] = [
  [/^TYT TÜRKÇE$/, "Türkçe", 40, false],
  [/^TYT SOSYAL$/, "Sosyal Bilimler", 20, false],
  [/^TYT MATEMATİK$/, "Temel Matematik", 40, false],
  [/^TYT FEN$/, "Fen Bilimleri", 20, false],
  [/^TÜRKÇE$/, "Türkçe", 40, false],
  [/^TARİH(-1)?$/, "Tarih", 5, false],
  [/^COĞRAFYA(-1)?$/, "Coğrafya", 5, false],
  [/^FELSEFE \(SEÇMELİ\)$/, "Felsefe (Seçmeli)", 5, true],
  [/^FELSEFE$/, "Felsefe", 5, false],
  [/^DİN KÜL/, "Din Kültürü ve Ahlak Bilgisi", 5, false],
  [/^MATEMATİK(-1)?$/, "Matematik", 30, false],
  [/^GEOMETRİ$/, "Geometri", 10, false],
  [/^FİZİK$/, "Fizik", 7, false],
  [/^KİMYA$/, "Kimya", 7, false],
  [/^BİYOLOJİ$/, "Biyoloji", 6, false],
];

type Token = { x: number; str: string };
/** Öğeleri boşluktan ve "12-XX33" gibi bitişik sınıf+sayıdan böler; parçanın orta noktası harf oranıyla tahmin edilir. */
function tokensOf(items: PdfItem[]): Token[] {
  const out: Token[] = [];
  for (const it of items) {
    const len = Math.max(1, it.str.length);
    const center = (offset: number, n: number) => it.x + (it.w * (offset + n / 2)) / len;
    for (const m of it.str.matchAll(/\S+/g)) {
      const glued = m[0].match(/^((?:\d{1,2}|MEZUN)-[A-ZÇĞİÖŞÜ]+)(\d{1,3})$/i);
      if (glued) {
        out.push({ x: center(m.index!, glued[1].length), str: glued[1] });
        out.push({ x: center(m.index! + glued[1].length, glued[2].length), str: glued[2] });
      } else out.push({ x: center(m.index!, m[0].length), str: m[0] });
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

const centerOf = (i: PdfItem) => i.x + i.w / 2;
const SKIP = ["Sıra", "Ö.No", "İsim", "Sınıf"];

type Header = {
  name: string;
  institution: string;
  sections: { name: string; count: number; optional: boolean; d: number; y: number; n: number }[];
  puan: number | null;
  ranks: { label: string; x: number }[];
};

export function parseNetList(pages: PdfItem[][]): PdfExam[] {
  // Aynı PDF'te iki tablo olabilir (4 ana test ve alt dersler); sayfalar başlıklarına göre gruplanır, ayrıntılısı seçilir
  const tables = new Map<string, { header: Header; students: PdfStudent[] }>();
  for (const items of pages) {
    let header: Header | null = null;
    const text = items.map((i) => i.str).join(" ");
    if (!/NET LİSTESİ/.test(text) || !/İsim/.test(text)) continue;
    const rows = rowsOf(items);
    const colRow = rows.find((r) => r.items.filter((i) => /^[DYN]$/.test(i.str.trim())).length >= 9);
    const nameHead = rows.find((r) => r.items.some((i) => i.str.trim() === "İsim"));
    if (!colRow || !nameHead) continue;
    {
      const puanItem = colRow.items.find((i) => i.str.trim() === "Puan");
      const puanX = puanItem ? centerOf(puanItem) : Infinity;
      // Ders başlıkları D/Y/N satırının üstünde; grup başlığı satırı da olabilir, en çok başlık taşıyan satır alınır
      const titleOf = (r: Row) => r.items.filter((i) => i.x > 140 && i.x < puanX - 15 && !SKIP.includes(i.str.trim()) && /\p{L}/u.test(i.str));
      const titleItems =
        rows
          .filter((r) => r.y > colRow.y && r.y <= nameHead.y + 15)
          .map(titleOf)
          .sort((a, b) => b.length - a.length)[0] ?? [];
      const titles = titleItems
        .sort((a, b) => a.x - b.x)
        .flatMap((i) => i.str.split(/(?<=\))(?=\S)/))
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      const dyn = colRow.items.filter((i) => /^[DYN]$/.test(i.str.trim()) && centerOf(i) < puanX);
      const triples: { d: number; y: number; n: number }[] = [];
      for (let k = 0; k + 2 < dyn.length; k++) {
        if (dyn[k].str.trim() === "D" && dyn[k + 1].str.trim() === "Y" && dyn[k + 2].str.trim() === "N") {
          triples.push({ d: centerOf(dyn[k]), y: centerOf(dyn[k + 1]), n: centerOf(dyn[k + 2]) });
          k += 2;
        }
      }
      if (titles.length !== triples.length || up(titles[titles.length - 1]) !== "TOPLAM") continue;
      const secs = titles.slice(0, -1).map((t, i) => {
        const hit = NET_LIST_COUNTS.find(([re]) => re.test(up(t)));
        return hit ? { name: hit[1], count: hit[2], optional: hit[3], ...triples[i] } : null;
      });
      if (secs.some((s) => !s)) continue;
      // Deneme adı ve kurum: "SINAV ADI" / "OKUL" başlıklarının altındaki satır
      const labelRow = rows.find((r) => r.items.some((i) => i.str.trim() === "SINAV ADI"));
      const valueRow = labelRow ? rows.find((r) => r.y < labelRow.y && r.y > labelRow.y - 25) : undefined;
      const under = (label: string) => {
        const l = labelRow?.items.find((i) => i.str.trim() === label);
        if (!l || !valueRow) return "";
        return valueRow.items.filter((i) => /\p{L}/u.test(i.str)).sort((a, b) => Math.abs(centerOf(a) - centerOf(l)) - Math.abs(centerOf(b) - centerOf(l)))[0]?.str.trim() ?? "";
      };
      const RANK: Record<string, string> = { Sn: "Sınıf", Okul: "Okul", İlçe: "İlçe", İl: "İl", Genel: "Genel" };
      header = {
        name: under("SINAV ADI"),
        institution: under("OKUL"),
        sections: secs as NonNullable<(typeof secs)[number]>[],
        puan: Number.isFinite(puanX) ? puanX : null,
        ranks: colRow.items.filter((i) => centerOf(i) > puanX && RANK[i.str.trim()]).map((i) => ({ label: RANK[i.str.trim()], x: centerOf(i) })),
      };
    }
    if (!header) continue;
    const h: Header = header;
    const tableKey = h.sections.map((x) => x.name).join("|");
    const table = tables.get(tableKey) ?? { header: h, students: [] };
    tables.set(tableKey, table);
    const students = table.students;
    const head = (label: string) => {
      const i = nameHead.items.find((x) => x.str.trim() === label);
      return i ? { x: i.x, c: centerOf(i) } : null;
    };
    const noCol = head("Ö.No") ?? { x: 42, c: 50 };
    const classCol = head("Sınıf") ?? { x: 131, c: 140 };
    const firstD = h.sections[0].d;
    for (const r of rows) {
      if (r.y >= colRow.y || /Ortalama/.test(r.items.map((i) => i.str).join(" "))) continue;
      const tokens = tokensOf(r.items);
      if (!tokens.length || !/^\d{1,4}$/.test(tokens[0].str) || tokens[0].x > noCol.x - 3) continue;
      const nameParts = tokens
        .filter((t) => t.x > noCol.c + 8 && t.x < classCol.x - 2 && t.str !== "*")
        .map((t) => t.str.replace(/\*+$/, ""))
        .filter((s) => /\p{L}/u.test(s));
      if (!nameParts.length) continue;
      const no = tokens.find((t) => Math.abs(t.x - noCol.c) < 10 && /^\d+$/.test(t.str))?.str ?? "";
      const cls = tokens.find((t) => t.x >= classCol.x - 2 && t.x < firstD - 6 && /\p{L}/u.test(t.str))?.str ?? "";
      const numeric = tokens.filter((t) => t.x > firstD - 10 && /^-?\d+(,\d+)?$/.test(t.str));
      const at = (x: number) => {
        const t = [...numeric].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
        return t && Math.abs(t.x - x) < 9 ? num(t.str) : null;
      };
      const sections = h.sections.map((s): PdfStudentSection | null => {
        const d = at(s.d);
        const y = at(s.y);
        const n = at(s.n);
        if (d === null || y === null || n === null) return null;
        if (s.optional && d === 0 && y === 0) return null;
        return { correct: d, wrong: y, net: n, answers: null };
      });
      if (sections.every((s) => !s)) continue;
      const scoreTok = h.puan === null ? undefined : numeric.find((t) => Math.abs(t.x - h.puan!) < 14 && /^\d+,\d{2,3}$/.test(t.str));
      const ranks: ExternalRank[] = h.ranks.flatMap((rk) => {
        const t = numeric.filter((t) => /^\d+$/.test(t.str) && t.x > (h.puan ?? 0) + 12).sort((a, b) => Math.abs(a.x - rk.x) - Math.abs(b.x - rk.x))[0];
        return t && Math.abs(t.x - rk.x) < 14 ? [{ label: rk.label, rank: Number(t.str), of: null }] : [];
      });
      students.push({ name: nameParts.join(" "), number: no === "0" ? "" : no, className: cls, score: scoreTok ? num(scoreTok.str) : null, ranks, sections });
    }
  }
  const best = [...tables.values()].filter((t) => t.students.length).sort((a, b) => b.header.sections.length - a.header.sections.length || b.students.length - a.students.length)[0];
  if (!best) return [];
  const { header, students } = best;
  const regular = header.sections.filter((s) => !s.optional);
  // Tablo "(TYT sıralı)"; MSÜ de TYT biçiminde
  const kind = detectKind(`TYT ${header.name}`, regular.map((s) => s.count));
  const names = presetSectionsFor(kind, regular.map((s) => s.count));
  const penalty = inferPenalty(students.flatMap((s) => s.sections.filter((x): x is PdfStudentSection => Boolean(x)))) ?? EXAM_PRESETS[kind].wrongPenalty;
  let r = 0;
  return [
    {
      name: header.name,
      institution: header.institution,
      kind,
      wrongPenalty: penalty,
      sections: header.sections.map((s) => {
        const p = s.optional ? null : names[r++];
        return { label: s.name, name: p?.name ?? s.name, questionCount: s.count, answerKey: null, topics: [], subjectSlug: p?.subjectSlug ?? guessSubject(s.name) };
      }),
      students,
      notes: ["Bu liste yalnızca netleri içerir; konu analizi için aynı denemenin karne PDF'ini yükleyin."],
    },
  ];
}

// tymm.json (MEB TYMM içerik çerçevesi) + planpro-sinav.json → src/lib/curriculum-presets.ts
import { readFileSync, writeFileSync } from "node:fs";

const [tymmPath, examPath, outPath] = process.argv.slice(2);
const tymm = JSON.parse(readFileSync(tymmPath, "utf8"));
const exams = JSON.parse(readFileSync(examPath, "utf8"));

const SUBJECT = {
  "ortaokul-matematik-dersi": "Matematik",
  "ortaokul-turkce-dersi": "Türkçe",
  "fen-bilimleri-dersi": "Fen Bilimleri",
  "sosyal-bilgiler-dersi": "Sosyal Bilgiler",
  "tc-inkilap-tarihi-ve-ataturkculuk-dersi": "T.C. İnkılap Tarihi ve Atatürkçülük",
  "din-kulturu-ve-ahlak-bilgisi-dersi-temel-egitim": "Din Kültürü ve Ahlak Bilgisi",
  "matematik-dersi": "Matematik",
  "turk-dili-ve-edebiyati-dersi": "Türk Dili ve Edebiyatı",
  "fizik-dersi": "Fizik",
  "kimya-dersi": "Kimya",
  "biyoloji-dersi": "Biyoloji",
  "tarih-dersi": "Tarih",
  "cografya-dersi": "Coğrafya",
  "felsefe-dersi": "Felsefe",
  "din-kulturu-ve-ahlak-bilgisi-dersi-ortaogretim": "Din Kültürü ve Ahlak Bilgisi",
};
// 2026-2027'de Maarif Modeli 5, 6, 7, 9, 10, 11. sınıflarda; 8 ve 12'de 2027-2028'de başlıyor
const ACTIVE = new Set([5, 6, 7, 9, 10, 11]);

/** Üst düzey virgüllerden böl (parantez içindekiler bölünmez) */
function splitTop(line) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of line) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function topicsOf(content) {
  if (!content) return [];
  const out = [];
  for (let line of content.split("\n")) {
    line = line.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
    if (!line) continue;
    // "Cebirsel Düşünme: Eşitlik..., ..." → başlık atılır, kalan bölünür
    const m = /^([^:()]{2,60}):\s*(.*)$/.exec(line);
    if (m) { line = m[2].trim(); if (!line) continue; }
    const pieces = splitTop(line);
    for (const p of pieces.length > 1 ? pieces : [line]) {
      const t = p.replace(/^[-•–]\s*/, "").trim();
      if (t.length >= 2 && t.length <= 160) out.push(t);
    }
  }
  return out;
}

const presets = [];
for (const [slug, grades] of Object.entries(tymm)) {
  const subject = SUBJECT[slug];
  if (!subject) continue;
  for (const g of grades) {
    const grade = Number(/(\d+)/.exec(g.label)?.[1]);
    if (!grade || grade < 5 || grade > 12) continue;
    const topics = [];
    const seen = new Set();
    for (const u of g.units) for (const t of topicsOf(u.content)) {
      const k = t.toLocaleLowerCase("tr-TR");
      if (!seen.has(k)) { seen.add(k); topics.push(t); }
    }
    if (!topics.length) continue;
    presets.push({ id: `maarif-${grade}-${slug}`, group: `${grade}. sınıf (MEB Maarif Modeli)`, label: subject, subject, grade, active: ACTIVE.has(grade), topics, units: g.units.length });
  }
}
presets.sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label, "tr"));

// Sınav listeleri: "## BAŞLIK" satırları alan ayırıcı; alan başına ayrı liste
const EXAM = [
  ["KONULAR_TYT_TURKCE", "TYT", "Türkçe"], ["KONULAR_TYT_MATEMATIK", "TYT", "Matematik"], ["KONULAR_TYT_GEOMETRI", "TYT", "Geometri"],
  ["KONULAR_TYT_FEN", "TYT", null], ["KONULAR_TYT_SOSYAL", "TYT", null], ["KONULAR_AYT_EDEBIYAT", "AYT", "Türk Dili ve Edebiyatı"],
  ["KONULAR_AYT_MATEMATIK", "AYT", "Matematik"], ["KONULAR_AYT_FEN", "AYT", null], ["KONULAR_AYT_SOSYAL", "AYT", null], ["KONULAR_LGS", "LGS", null],
];
const HEAD = { "TÜRKÇE": "Türkçe", "MATEMATİK": "Matematik", "FEN BİLİMLERİ": "Fen Bilimleri", "T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK": "T.C. İnkılap Tarihi ve Atatürkçülük", "DİN KÜLTÜRÜ VE İNGİLİZCE": "Din Kültürü ve İngilizce", "TARİH": "Tarih", "COĞRAFYA": "Coğrafya", "DİN KÜLTÜRÜ": "Din Kültürü", "FELSEFE": "Felsefe", "FELSEFE GRUBU": "Felsefe Grubu", "FİZİK": "Fizik", "KİMYA": "Kimya", "BİYOLOJİ": "Biyoloji" };
const title = (s) => HEAD[s] ?? s;
const examPresets = [];
for (const [key, exam, subject] of EXAM) {
  let current = subject;
  let list = [];
  const flush = () => { if (current && list.length) examPresets.push({ id: `sinav-${exam}-${current}`.toLowerCase().replace(/[^a-z0-9ğüşıöç-]+/g, "-"), group: `${exam} konuları`, label: current, subject: current, exam, topics: list }); list = []; };
  for (const t of exams[key]) {
    if (t.startsWith("## ")) { flush(); current = title(t.slice(3).trim()); continue; }
    list.push(t);
  }
  flush();
}

const header = `// Hazır konu listeleri (kaynak eklerken "Hazır listeden doldur").
// Sınıf listeleri: MEB Türkiye Yüzyılı Maarif Modeli öğretim programlarının "İçerik Çerçevesi" (tymm.meb.gov.tr), 2026-11-15.
// 2026-2027'de Maarif Modeli 5, 6, 7, 9, 10 ve 11. sınıflarda uygulanıyor; 8 ve 12. sınıflarda 2027-2028'de başlıyor (active=false).
// Sınav listeleri (TYT, AYT, LGS): yaygın konu listeleri; ÖSYM resmi konu listesi yayımlamaz. Üretici: scratchpad gen-curriculum.mjs
// (Bu dosya üretilmiştir; elle düzenlenebilir.)

export type CurriculumPreset = { id: string; group: string; label: string; subject: string; grade?: number; exam?: string; active?: boolean; topics: string[] };

export const CURRICULUM_PRESETS: CurriculumPreset[] = `;
const all = [...examPresets, ...presets].map(({ units, ...p }) => p);
writeFileSync(outPath, header + JSON.stringify(all, null, 1) + ";\n");
console.log("sınav", examPresets.length, "sınıf", presets.length, "toplam konu", all.reduce((t, p) => t + p.topics.length, 0));

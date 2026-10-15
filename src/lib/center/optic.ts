// Optik okuyucu çıktısı (sabit konumlu TXT/DAT) okuma. Konumlar 1'den başlar; her satır bir öğrenci formudur.

export type OpticTemplateShape = {
  numberStart: number;
  numberLength: number;
  nameStart: number | null;
  nameLength: number | null;
  sections: { start: number; length: number }[];
};

export type OpticRow = { line: number; number: string; name: string; answers: string[] };

const slice = (line: string, start: number, length: number) => line.slice(Math.max(0, start - 1), Math.max(0, start - 1) + length);

/** Cevap alanını A-E / - (boş) / * (çift işaret, yanlış sayılır) biçimine getirir. */
export function normalizeOpticAnswers(raw: string, length: number): string {
  return Array.from({ length }, (_, i) => {
    const c = (raw[i] ?? " ").toLocaleUpperCase("tr-TR");
    if ("ABCDE".includes(c) && c !== " ") return c;
    if (c === "*" || c === "#") return "*";
    return "-";
  }).join("");
}

export function parseOpticFile(text: string, template: OpticTemplateShape): OpticRow[] {
  const rows: OpticRow[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.replace(/\t/g, " ");
    if (!line.trim()) continue;
    const number = slice(line, template.numberStart, template.numberLength).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    const name = template.nameStart && template.nameLength ? slice(line, template.nameStart, template.nameLength).trim().replace(/\s+/g, " ") : "";
    const answers = template.sections.map((s) => normalizeOpticAnswers(slice(line, s.start, s.length), s.length));
    rows.push({ line: index + 1, number, name, answers });
  }
  return rows;
}

/** "40:20, 60:20" ya da satır satır "40 20" → [{start:40,length:20}, …] */
export function parseSectionPositions(text: string): { start: number; length: number }[] {
  return text
    .split(/[\r\n,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [start, length] = part.split(/[\s:/-]+/).map(Number);
      if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1 || length > 200) throw new Error(`Geçersiz ders konumu: “${part}”. Örnek: 40:20`);
      return { start, length };
    });
}

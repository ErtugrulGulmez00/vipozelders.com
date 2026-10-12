// Excel (Türkçe) ile doğrudan açılan CSV: UTF-8 BOM, ";" ayırıcı, ondalıkta virgül.

export type CsvCell = string | number | null | undefined;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value).replace(".", ",") : value;
  // Kullanıcı metni formül gibi başlıyorsa Excel'in çalıştırmaması için başına ' eklenir.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
}

/** Kuruş → 1250,5 (Excel'de sayı olarak görünür) */
export function csvMoney(kurus: number): number {
  return kurus / 100;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

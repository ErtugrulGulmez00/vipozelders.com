// Tek seferlik: YKS başarı sıralarını ekler. Yalnızca "minRank" güncellenir; puan, kontenjan ve diğer alanlar (ÖSYM) değişmez.
// Dosya: "Program Kodu" ve "Taban Başarı Sırası" sütunları olan CSV (; ya da ,) ya da Excel.
// Kullanım: npx tsx --conditions=react-server --env-file=.env scripts/basari-sirasi-yukle.ts 2026 dosya.csv
import { readFile } from "node:fs/promises";
import { headerKey, parseNumber } from "../src/lib/placement";
import { readSpreadsheet } from "../src/server/center/spreadsheet";
import { db } from "../src/server/db";

const [yearArg, path] = process.argv.slice(2);
const year = Number(yearArg);
if (!Number.isInteger(year) || !path) throw new Error("Yıl ve dosya verin.");
const bytes = await readFile(path);
let table: string[][];
if (/\.csv$/i.test(path)) {
  const text = bytes.toString("utf8").replace(/^﻿/, "");
  const sep = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  table = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, "")));
} else {
  table = await readSpreadsheet(new File([bytes], path.split(/[\\/]/).pop()!), 50 * 1024 * 1024);
}
const head = table.findIndex((row) => row.some((cell) => headerKey(cell) === "programkodu"));
if (head < 0) throw new Error("Program Kodu sütunu bulunamadı.");
const iCode = table[head].findIndex((cell) => headerKey(cell) === "programkodu");
const iRank = table[head].findIndex((cell) => ["tabanbasarisirasi", "basarisirasi"].includes(headerKey(cell)));
if (iRank < 0) throw new Error("Başarı sırası sütunu bulunamadı.");
const ranks = table
  .slice(head + 1)
  .map((row) => ({ code: (row[iCode] ?? "").replace(/\s+/g, ""), rank: parseNumber(row[iRank] ?? "", true) }))
  .filter((r): r is { code: string; rank: number } => Boolean(r.code) && r.rank !== null && r.rank > 0);

let updated = 0;
for (let i = 0; i < ranks.length; i += 500) {
  const chunk = ranks.slice(i, i + 500);
  const values = chunk.flatMap((r) => [r.code, r.rank]);
  const tuples = chunk.map((_, k) => `($${k * 2 + 1}, $${k * 2 + 2}::int)`).join(", ");
  updated += await db.$executeRawUnsafe(
    `UPDATE "PlacementProgram" p SET "minRank" = v.rank FROM (VALUES ${tuples}) AS v(code, rank) WHERE p.exam = 'YKS' AND p.year = ${year} AND p.code = v.code`,
    ...values,
  );
}
console.log(`${ranks.length} sıra okundu, ${updated} program güncellendi`);
await db.$disconnect();

// Tek seferlik: ÖSYM "En Küçük ve En Büyük Puanlar" Excel dosyalarını tercih robotuna yükler.
// Kullanım: npx tsx --conditions=react-server --env-file=.env scripts/osym-yukle.ts 2026 dosya1.xlsx dosya2.xlsx
import { readFile } from "node:fs/promises";
import { parseProgramTable } from "../src/lib/placement";
import { readSpreadsheet } from "../src/server/center/spreadsheet";
import { db } from "../src/server/db";
import { upsertPrograms } from "../src/server/placement";

const [yearArg, ...files] = process.argv.slice(2);
const year = Number(yearArg);
if (!Number.isInteger(year) || !files.length) throw new Error("Yıl ve dosya verin.");
const admin = await db.user.findFirstOrThrow({ where: { role: "ADMIN" }, select: { id: true } });
for (const path of files) {
  const file = new File([await readFile(path)], path.split(/[\/]/).pop()!);
  const parsed = parseProgramTable("YKS", await readSpreadsheet(file, 25 * 1024 * 1024));
  if (parsed.missing.length) throw new Error(`${path}: eksik sütun ${parsed.missing.join(", ")}`);
  const result = await upsertPrograms(admin.id, "YKS", year, parsed.rows, false);
  console.log(`${file.name}: ${result.count} program, ${parsed.skipped} atlandı`);
}
await db.$disconnect();

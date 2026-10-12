import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/center/import";
import { CenterError } from "./errors";

// Excel (.xlsx) ve CSV dosyalarını tabloya çevirir; şablon ve dışa aktarım için .xlsx üretir.

const MAX_BYTES = 5 * 1024 * 1024;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const d = value;
    return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  }
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
    return "";
  }
  return String(value);
}

export async function readSpreadsheet(file: File): Promise<string[][]> {
  if (!file || file.size === 0) throw new CenterError("Dosya seçin.");
  if (file.size > MAX_BYTES) throw new CenterError("Dosya en fazla 5 MB olabilir.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    if (/\.xls$/i.test(file.name)) throw new CenterError("Eski .xls biçimi desteklenmiyor; Excel'de “Farklı kaydet → Excel Çalışma Kitabı (.xlsx)” seçin.");
    return parseCsv(bytes.toString("utf8"));
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } catch {
    throw new CenterError("Excel dosyası okunamadı. Dosyanın bozuk olmadığından emin olun.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new CenterError("Excel dosyasında sayfa bulunamadı.");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) cells.push(cellText(row.getCell(c).value).trim());
    if (cells.some(Boolean)) rows.push(cells);
  });
  return rows;
}

export type SheetSpec = { name: string; headers: string[]; rows: (string | number | null)[][]; widths?: number[]; note?: string };

export async function buildWorkbook(sheets: SheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pi Kampüs";
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name.slice(0, 31));
    sheet.addRow(spec.headers);
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    for (const row of spec.rows) sheet.addRow(row);
    spec.headers.forEach((h, i) => (sheet.getColumn(i + 1).width = spec.widths?.[i] ?? Math.max(12, h.length + 4)));
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    if (spec.note) {
      const noteRow = sheet.addRow([]);
      noteRow.getCell(1).value = spec.note;
      noteRow.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
    }
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function xlsxResponse(filename: string, data: Buffer): Response {
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

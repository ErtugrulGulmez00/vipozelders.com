import { getDocumentProxy } from "unpdf";
import type { PdfItem } from "@/lib/center/exam-pdf";

// PDF'ten sayfa başına konumlu metin parçaları (taranmış/resim PDF'te metin çıkmaz).

export async function readPdfItems(bytes: Uint8Array, maxPages = 600): Promise<PdfItem[][]> {
  const pdf = await getDocumentProxy(bytes);
  try {
    const pages: PdfItem[][] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(
        content.items.flatMap((item) =>
          "str" in item && item.str.trim() ? [{ x: item.transform[4] as number, y: item.transform[5] as number, w: item.width, str: item.str }] : [],
        ),
      );
      page.cleanup();
    }
    return pages;
  } finally {
    await pdf.cleanup().catch(() => {});
  }
}

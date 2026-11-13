// Beyaz tahtaya dosya ekleme: fotoğraf küçültülür, PDF tarayıcıda sayfa sayfa görsele çevrilir; görseller sunucuya
// yüklenir (karşı taraf /api/tahta'dan çeker). Tablette ekran paylaşımı olmadığı için soru ve sayfa göstermenin yolu budur.

export const MAX_PDF_PAGES = 30;
const MAX_SIDE = 1800;
const JPEG_QUALITY = 0.85;

export type BoardImage = { blob: Blob; width: number; height: number };

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Görsel oluşturulamadı."))), "image/jpeg", JPEG_QUALITY));
}

async function imageFile(file: File): Promise<BoardImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { blob: await canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
}

async function* pdfPages(file: File): AsyncGenerator<BoardImage, void, unknown> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, canvas, viewport } as never).promise;
    yield { blob: await canvasToJpeg(canvas), width: canvas.width, height: canvas.height };
  }
}

/** Seçilen dosyalardan tahtaya eklenecek görseller (PDF'in her sayfası ayrı görsel). */
export async function* boardImages(files: File[]): AsyncGenerator<BoardImage, void, unknown> {
  for (const file of files) {
    if (isPdf(file)) yield* pdfPages(file);
    else if (file.type.startsWith("image/")) yield await imageFile(file);
  }
}

/** Görseli sunucuya yükler; dönen anahtar tahtadaki görselin kimliğidir. */
export async function uploadBoardImage(image: BoardImage): Promise<string> {
  const form = new FormData();
  form.append("file", new File([image.blob], "tahta.jpg", { type: "image/jpeg" }));
  const res = await fetch("/api/tahta", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!res.ok || !data.key) throw new Error(data.error ?? "Dosya yüklenemedi.");
  return data.key;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Karşı tarafın eklediği görseli sunucudan çeker. */
export async function fetchBoardImage(key: string): Promise<string> {
  const res = await fetch(`/api/tahta?k=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error("Görsel alınamadı.");
  return blobToDataUrl(await res.blob());
}

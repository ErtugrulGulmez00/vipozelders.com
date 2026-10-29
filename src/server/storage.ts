import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Yüklenen dosyalar. Geliştirmede proje içindeki storage/ klasörüne yazılır;
 * canlıda aynı arayüzle S3 uyumlu bir depolamaya geçilebilir.
 *  - public/...  → herkese açık (öğretmen fotoğrafı)
 *  - private/... → yalnızca sahibi ve yetkililer (belgeler, kurum soru fotoğrafları ve çözüm videoları)
 */

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "storage/uploads");

/** Yüklenen dosyalar çalışma anında oluşur; derleme çıktısına dahil edilmemeleri için izlenmez. */
function storagePath(key: string): string {
  return path.join(/*turbopackIgnore: true*/ ROOT, key);
}

const KEY_PATTERN = /^(public|private)\/[a-z0-9-]+\/[0-9a-f-]{36}\.(jpg|png|webp|pdf|mp4|webm|mov)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

const VIDEO = new Set(["mp4", "webm", "mov"]);

function sniffExtension(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "webp";
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  // ISO medya dosyası ("ftyp" kutusu): iPhone videoları "qt  " markasıyla gelir
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "qt  " ? "mov" : "mp4";
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  return null;
}

export class UploadError extends Error {}

// Telefon fotoğrafları (10-20 MB) kaydedilmeden küçültülür; sınır küçültülmüş dosyaya uygulanır.
const SHRINK_ABOVE = 1024 * 1024;
const MAX_SIDE = 2400;
const RAW_IMAGE_MAX = 25 * 1024 * 1024;

/** Fotoğrafı döndürür (EXIF), en uzun kenarı maxSide olacak şekilde küçültür, konum vb. bilgileri atar. */
async function shrinkImage(bytes: Uint8Array, maxSide: number): Promise<{ bytes: Uint8Array; extension: string } | null> {
  try {
    const { default: sharp } = await import("sharp");
    const image = sharp(bytes).rotate().resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });
    // Saydam görsel (logo) WEBP olarak saydamlığını korur
    const { hasAlpha } = await sharp(bytes).metadata();
    const output = hasAlpha ? await image.webp({ quality: 85 }).toBuffer() : await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { bytes: new Uint8Array(output), extension: hasAlpha ? "webp" : "jpg" };
  } catch (error) {
    console.error("[yükleme] fotoğraf küçültülemedi", error);
    return null;
  }
}

const tooBig = (bytes: number) => new UploadError(`Dosya en fazla ${Math.round(bytes / 1024 / 1024)} MB olabilir.`);

export async function saveUpload(
  file: File,
  options: { visibility: "public" | "private"; folder: string; maxBytes: number; kinds: ("image" | "pdf" | "video")[]; maxSide?: number },
): Promise<string> {
  if (file.size === 0) throw new UploadError("Dosya boş.");
  const shrinkable = options.kinds.includes("image");
  const rawLimit = shrinkable ? Math.max(options.maxBytes, RAW_IMAGE_MAX) : options.maxBytes;
  if (file.size > rawLimit) throw tooBig(rawLimit);
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  let extension = sniffExtension(bytes);
  const allowed =
    extension !== null &&
    ((extension === "pdf" && options.kinds.includes("pdf")) ||
      (VIDEO.has(extension) && options.kinds.includes("video")) ||
      (extension !== "pdf" && !VIDEO.has(extension) && options.kinds.includes("image")));
  if (!allowed) {
    throw new UploadError(
      options.kinds.includes("video")
        ? "Yalnızca MP4, MOV veya WEBM video yükleyebilirsiniz."
        : options.kinds.includes("pdf")
          ? "Yalnızca JPG, PNG, WEBP veya PDF yükleyebilirsiniz."
          : "Yalnızca JPG, PNG veya WEBP yükleyebilirsiniz.",
    );
  }
  if (shrinkable && extension && extension !== "pdf" && !VIDEO.has(extension) && bytes.length > SHRINK_ABOVE) {
    const small = await shrinkImage(bytes, options.maxSide ?? MAX_SIDE);
    if (small && small.bytes.length < bytes.length) ({ bytes, extension } = small);
  }
  if (bytes.length > options.maxBytes) throw tooBig(options.maxBytes);

  const key = `${options.visibility}/${options.folder}/${randomUUID()}.${extension}`;
  const target = storagePath(key);
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ target, bytes);
  return key;
}

export function isValidStorageKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export async function readUpload(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isValidStorageKey(key)) return null;
  try {
    const data = await fs.readFile(/*turbopackIgnore: true*/ storagePath(key));
    return { data, contentType: CONTENT_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

export async function deleteUpload(key: string | null | undefined) {
  if (!key || !isValidStorageKey(key)) return;
  await fs.rm(/*turbopackIgnore: true*/ storagePath(key), { force: true });
}

export function uploadUrl(key: string | null | undefined): string | null {
  return key ? `/api/dosya/${key}` : null;
}

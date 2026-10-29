import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir: string;
let storage: typeof import("@/server/storage");

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "pk-yukleme-"));
  process.env.STORAGE_DIR = dir;
  storage = await import("@/server/storage");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

// Gürültülü görsel iyi sıkışmaz; telefon fotoğrafı kadar büyük dosya verir
async function noiseImage(width: number, height: number, channels: 3 | 4) {
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.floor(Math.random() * 256);
  const image = sharp(raw, { raw: { width, height, channels } });
  return channels === 4 ? image.png().toBuffer() : image.jpeg({ quality: 100 }).toBuffer();
}

const MB = 1024 * 1024;

describe("dosya yükleme", () => {
  it("5 MB'ı aşan telefon fotoğrafı reddedilmez, küçültülüp kaydedilir", async () => {
    const photo = await noiseImage(3000, 2000, 3);
    expect(photo.length).toBeGreaterThan(5 * MB);
    const key = await storage.saveUpload(new File([photo], "foto.jpg", { type: "image/jpeg" }), {
      visibility: "public",
      folder: "ogretmen",
      maxBytes: 5 * MB,
      kinds: ["image"],
      maxSide: 1200,
    });
    expect(key).toMatch(/\.jpg$/);
    const saved = await readFile(path.join(dir, key));
    expect(saved.length).toBeLessThan(5 * MB);
    const meta = await sharp(saved).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 800]);
  });

  it("saydam görsel küçültülünce saydamlığını korur", async () => {
    const logo = await noiseImage(1500, 1500, 4);
    expect(logo.length).toBeGreaterThan(5 * MB);
    const key = await storage.saveUpload(new File([logo], "logo.png"), { visibility: "public", folder: "kurum", maxBytes: 5 * MB, kinds: ["image"] });
    expect(key).toMatch(/\.webp$/);
    expect((await sharp(await readFile(path.join(dir, key))).metadata()).hasAlpha).toBe(true);
  });

  it("PDF küçültülmez; sınırı aşınca anlaşılır mesajla reddedilir", async () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(6 * MB)]);
    await expect(
      storage.saveUpload(new File([pdf], "diploma.pdf"), { visibility: "private", folder: "belge", maxBytes: 5 * MB, kinds: ["image", "pdf"] }),
    ).rejects.toThrow("Dosya en fazla 5 MB olabilir.");
  });
});

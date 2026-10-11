import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Hassas alanlar (ör. T.C. kimlik no) veritabanında AES-256-GCM ile şifreli tutulur.

function key(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET en az 32 karakter olmalı (.env).");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptText(payload: string): string {
  const data = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

/** "12345678901" → "123******01" */
export function maskIdentityNumber(value: string): string {
  return value.length === 11 ? `${value.slice(0, 3)}******${value.slice(-2)}` : "***";
}

import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

type ScryptParams = { N: number; r: number; p: number };

function scrypt(password: string, salt: Buffer, keyLength: number, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { ...params, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

const PARAMS: ScryptParams = { N: 16384, r: 8, p: 1 };

/** Şifreyi scrypt ile özetler: "scrypt$N$r$p$tuz$özet" */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, 64, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, saltB64, keyB64] = stored.split("$");
  if (algorithm !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Kullanıcı yokken de aynı süreyi harcayarak kullanıcı adı tahminini zorlaştırır. */
export async function burnPasswordCheck(password: string): Promise<void> {
  await scrypt(password.normalize("NFKC"), randomBytes(16), 64, PARAMS);
}

/** Şifre kuralı: en az 8 karakter, en az bir harf ve bir rakam. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (password.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(password) || !/\d/.test(password)) {
    return "Şifre en az bir harf ve bir rakam içermeli.";
  }
  return null;
}

const READABLE_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Admin'in öğretmene vereceği okunaklı geçici şifre (karışan karakterler yok). */
export function generateTemporaryPassword(length = 10): string {
  while (true) {
    let value = "";
    for (let i = 0; i < length; i++) {
      value += READABLE_ALPHABET[randomInt(READABLE_ALPHABET.length)];
    }
    if (/\d/.test(value) && /[a-zA-Z]/.test(value)) return value;
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

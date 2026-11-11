import { db } from "../db";

const WINDOW_MS = 15 * 60 * 1000;
// Aynı IP'den aynı hesaba 8 hata kilitler. Hesap başına genel sınır yüksek tutulur: başka biri yanlış şifre
// deneyerek gerçek sahibini (başka IP'den) dışarıda bırakamasın, dağıtık deneme de yine durdurulsun.
const MAX_FAILURES_PER_IDENTIFIER_IP = 8;
const MAX_FAILURES_PER_IDENTIFIER = 50;
const MAX_FAILURES_PER_IP = 30;

/** Son 15 dakikadaki başarısız giriş sayısı sınırı aştıysa true. */
export async function isLoginBlocked(identifier: string, ipAddress: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = { success: false, createdAt: { gte: since } };
  const [byIdentifier, byIdentifierIp, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { identifier, ...recent } }),
    ipAddress ? db.loginAttempt.count({ where: { identifier, ipAddress, ...recent } }) : Promise.resolve(0),
    ipAddress ? db.loginAttempt.count({ where: { ipAddress, ...recent } }) : Promise.resolve(0),
  ]);
  if (!ipAddress) return byIdentifier >= MAX_FAILURES_PER_IDENTIFIER_IP;
  return byIdentifierIp >= MAX_FAILURES_PER_IDENTIFIER_IP || byIdentifier >= MAX_FAILURES_PER_IDENTIFIER || byIp >= MAX_FAILURES_PER_IP;
}

export async function recordLoginAttempt(identifier: string, ipAddress: string | null, success: boolean) {
  await db.loginAttempt.create({ data: { identifier, ipAddress, success } });
  if (success) {
    await db.loginAttempt.deleteMany({ where: { identifier, success: false } });
  }
}

/** Aynı amaçla kullanılan genel sayaç: şifre sıfırlama gibi işlemler için. */
export async function countRecentAttempts(identifier: string, windowMs = WINDOW_MS): Promise<number> {
  return db.loginAttempt.count({ where: { identifier, createdAt: { gte: new Date(Date.now() - windowMs) } } });
}

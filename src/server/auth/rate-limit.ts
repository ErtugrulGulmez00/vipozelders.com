import { db } from "../db";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_IDENTIFIER = 8;
const MAX_FAILURES_PER_IP = 30;

/** Son 15 dakikadaki başarısız giriş sayısı sınırı aştıysa true. */
export async function isLoginBlocked(identifier: string, ipAddress: string | null): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [byIdentifier, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { identifier, success: false, createdAt: { gte: since } } }),
    ipAddress
      ? db.loginAttempt.count({ where: { ipAddress, success: false, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);
  return byIdentifier >= MAX_FAILURES_PER_IDENTIFIER || byIp >= MAX_FAILURES_PER_IP;
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

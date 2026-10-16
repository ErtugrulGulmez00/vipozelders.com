import type { UserTokenType } from "@/generated/prisma/client";
import { db } from "../db";
import { hashToken, randomToken } from "./password";

const TTL_MS: Record<UserTokenType, number> = {
  EMAIL_VERIFICATION: 3 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
  TWO_FACTOR_LOGIN: 10 * 60 * 1000,
  MOBILE_WEB_LOGIN: 5 * 60 * 1000,
};

// E-postayla giden bağlantılarda yeni bağlantı eskisini iptal etmez (art arda istenen e-postaların hepsi süresince
// çalışır); biri kullanılınca aynı türden diğerleri de kapanır.
const KEEP_PREVIOUS: UserTokenType[] = ["EMAIL_VERIFICATION", "PASSWORD_RESET"];

/** Tek kullanımlık bağlantı anahtarı üretir; veritabanında yalnızca özeti tutulur. */
export async function issueUserToken(userId: string, type: UserTokenType, ttlMs = TTL_MS[type]): Promise<string> {
  const token = randomToken();
  await db.userToken.deleteMany({
    where: { userId, type, usedAt: null, ...(KEEP_PREVIOUS.includes(type) ? { expiresAt: { lt: new Date() } } : {}) },
  });
  await db.userToken.create({
    data: { id: hashToken(token), userId, type, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

/** Geçerliyse anahtarı kullanılmış işaretler ve kullanıcı kimliğini döndürür. */
export async function consumeUserToken(token: string, type: UserTokenType): Promise<string | null> {
  const record = await db.userToken.findUnique({ where: { id: hashToken(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return null;
  }
  const updated = await db.userToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count !== 1) return null;
  if (KEEP_PREVIOUS.includes(type)) await db.userToken.deleteMany({ where: { userId: record.userId, type, usedAt: null } });
  return record.userId;
}

export async function peekUserToken(token: string, type: UserTokenType): Promise<boolean> {
  const record = await db.userToken.findUnique({ where: { id: hashToken(token) } });
  return Boolean(record && record.type === type && !record.usedAt && record.expiresAt.getTime() > Date.now());
}

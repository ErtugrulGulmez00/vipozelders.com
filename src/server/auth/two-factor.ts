import "server-only";
import { cookies } from "next/headers";
import { decryptText, encryptText } from "../crypto";
import { db } from "../db";
import { hashToken } from "./password";
import { secureCookies } from "./session";
import { issueUserToken } from "./tokens";
import { generateTotpSecret, verifyTotp } from "./totp";

/** Şifre doğrulandıktan sonra ikinci adım beklenirken tutulan geçici çerez. */
export const TWO_FACTOR_COOKIE = "vd_2fa";
const CHALLENGE_MINUTES = 10;

/** Şifresi doğru giren kullanıcı için ikinci adımı başlatır; oturum kod doğrulanınca açılır. */
export async function startTwoFactorChallenge(userId: string): Promise<void> {
  const token = await issueUserToken(userId, "TWO_FACTOR_LOGIN", CHALLENGE_MINUTES * 60_000);
  (await cookies()).set(TWO_FACTOR_COOKIE, token, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: CHALLENGE_MINUTES * 60 });
}

/** İkinci adımı bekleyen kullanıcı (çerez geçerliyse). */
export async function pendingTwoFactor() {
  const token = (await cookies()).get(TWO_FACTOR_COOKIE)?.value;
  if (!token) return null;
  const record = await db.userToken.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!record || record.type !== "TWO_FACTOR_LOGIN" || record.usedAt || record.expiresAt <= new Date()) return null;
  return { tokenId: record.id, user: record.user };
}

export async function endTwoFactorChallenge(tokenId: string): Promise<void> {
  await db.userToken.updateMany({ where: { id: tokenId, usedAt: null }, data: { usedAt: new Date() } });
  (await cookies()).delete(TWO_FACTOR_COOKIE);
}

/**
 * Kullanıcının kayıtlı anahtarıyla kodu doğrular ve adımı kaydeder (aynı kod ikinci kez kullanılamaz).
 * pending: kurulum onayı için henüz açılmamış anahtarı kullanır.
 */
export async function checkUserTotp(userId: string, code: string, mode: "enabled" | "pending" = "enabled"): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true, totpLastStep: true } });
  if (!user?.totpSecretEnc || (mode === "enabled") !== Boolean(user.totpEnabledAt)) return false;
  const step = verifyTotp(decryptText(user.totpSecretEnc), code, user.totpLastStep);
  if (step === null) return false;
  const updated = await db.user.updateMany({
    where: { id: userId, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
    data: { totpLastStep: step, ...(mode === "pending" ? { totpEnabledAt: new Date() } : {}) },
  });
  return updated.count === 1;
}

/** Kurulumu başlatır: yeni gizli anahtar üretir (onaylanana kadar girişte istenmez). */
export async function beginTotpSetup(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { totpSecretEnc: encryptText(generateTotpSecret()), totpEnabledAt: null, totpLastStep: null } });
}

export async function disableTotp(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null } });
}

export async function totpSetupState(userId: string): Promise<{ enabledAt: Date | null; pendingSecret: string | null }> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpSecretEnc: true, totpEnabledAt: true } });
  return {
    enabledAt: user.totpEnabledAt,
    pendingSecret: user.totpSecretEnc && !user.totpEnabledAt ? decryptText(user.totpSecretEnc) : null,
  };
}

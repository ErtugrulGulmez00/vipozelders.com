import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/auth-constants";
import { db } from "../db";
import { hashToken, randomToken } from "./password";

export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/** Yeni oturum açar ve çerezi yazar. Yalnızca Server Action / Route Handler içinde çağrılır. */
export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const meta = await requestMeta();

  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

export async function destroySession(): Promise<void> {
  const sessionId = await currentSessionId();
  if (sessionId) {
    await db.session.deleteMany({ where: { id: sessionId } });
  }
  (await cookies()).delete(SESSION_COOKIE);
}

/** Şifre değişince diğer cihazlardaki oturumları kapatır. */
export async function revokeOtherSessions(userId: string): Promise<void> {
  const sessionId = await currentSessionId();
  await db.session.deleteMany({ where: { userId, ...(sessionId ? { id: { not: sessionId } } : {}) } });
}

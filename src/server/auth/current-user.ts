import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { roleHome, SESSION_COOKIE, type AppRole } from "@/lib/auth-constants";
import { db } from "../db";
import { hashToken } from "./password";

export type SessionUser = {
  id: string;
  role: AppRole;
  firstName: string;
  lastName: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  mustChangePassword: boolean;
  emailVerified: boolean;
};

/** Çerezdeki oturumu doğrular; istek başına bir kez veritabanına gider. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Oturum süresi şimdiki zamana göre kontrol edildiği için okuma istek anında yapılmalı.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || session.user.status !== "ACTIVE") {
    return null;
  }

  const { user } = session;
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    mustChangePassword: user.mustChangePassword,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
});

export async function requireUser(options: { allowPendingPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  if (user.mustChangePassword && !options.allowPendingPasswordChange) redirect("/sifre-degistir");
  return user;
}

export async function requireRole(...roles: AppRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(roleHome(user.role));
  return user;
}

/** Server Action'larda yönlendirme yerine hata döndürmek için. */
export async function actionUser(...roles: AppRole[]): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return null;
  if (roles.length && !roles.includes(user.role)) return null;
  return user;
}

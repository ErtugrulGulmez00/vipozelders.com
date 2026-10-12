"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { roleHome, safeNextPath } from "@/lib/auth-constants";
import { normalizePhone } from "@/lib/text";
import { AccountError, registerStudent, sendPasswordResetEmail, sendVerificationEmail } from "@/server/accounts";
import { getCurrentUser } from "@/server/auth/current-user";
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { countRecentAttempts, isLoginBlocked, recordLoginAttempt } from "@/server/auth/rate-limit";
import { createSession, destroySession, requestMeta, revokeOtherSessions } from "@/server/auth/session";
import { consumeUserToken } from "@/server/auth/tokens";
import { checkUserTotp, endTwoFactorChallenge, pendingTwoFactor, startTwoFactorChallenge } from "@/server/auth/two-factor";
import { db } from "@/server/db";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const identifier = text(formData, "identifier").toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(text(formData, "next"));
  if (!identifier || !password) return failure("Kullanıcı adı/e-posta ve şifre gerekli.");

  const { ipAddress } = await requestMeta();
  if (await isLoginBlocked(identifier, ipAddress)) {
    return failure("Çok fazla hatalı deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
  }

  const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
  await recordLoginAttempt(identifier, ipAddress, valid);

  if (!user || !valid) return failure("Kullanıcı adı/e-posta veya şifre hatalı.");
  if (user.status !== "ACTIVE") return failure("Hesabınız askıya alınmış. Destek ekibimizle iletişime geçin.");

  // İki adımlı doğrulama açıksa oturum, doğrulayıcı uygulamadaki kod girilince açılır.
  if (user.totpEnabledAt && user.totpSecretEnc) {
    await startTwoFactorChallenge(user.id);
    redirect(`/giris/dogrulama${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }

  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  if (user.mustChangePassword) redirect("/sifre-degistir");
  redirect(next ?? roleHome(user.role));
}

export async function verifyTwoFactorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const pending = await pendingTwoFactor();
  if (!pending) redirect("/giris");
  const { user, tokenId } = pending;
  if (user.status !== "ACTIVE") return failure("Hesabınız askıya alınmış. Destek ekibimizle iletişime geçin.");

  const identifier = `2fa:${user.id}`;
  const { ipAddress } = await requestMeta();
  if (await isLoginBlocked(identifier, ipAddress)) {
    await endTwoFactorChallenge(tokenId);
    return failure("Çok fazla hatalı kod girildi. 15 dakika sonra yeniden giriş yapın.");
  }
  const ok = await checkUserTotp(user.id, text(formData, "code"));
  await recordLoginAttempt(identifier, ipAddress, ok);
  if (!ok) return failure("Kod hatalı veya süresi geçmiş.", { code: "Uygulamadaki güncel 6 haneli kodu yazın." });

  await endTwoFactorChallenge(tokenId);
  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const next = safeNextPath(text(formData, "next"));
  if (user.mustChangePassword) redirect("/sifre-degistir");
  redirect(next ?? roleHome(user.role));
}

const registerSchema = z.object({
  firstName: z.string().trim().min(2, "Adınızı yazın.").max(50),
  lastName: z.string().trim().min(2, "Soyadınızı yazın.").max(50),
  email: z.email("Geçerli bir e-posta adresi yazın.").max(120),
  phone: z.string().trim().optional(),
  password: z.string().min(1, "Şifre belirleyin."),
  accountType: z.enum(["PARENT", "STUDENT"], { error: "Hesap tipini seçin." }),
  kvkk: z.literal("on", { error: "Devam etmek için aydınlatma metnini onaylayın." }),
  terms: z.literal("on", { error: "Devam etmek için kullanım şartlarını kabul edin." }),
  marketing: z.string().optional(),
});

export async function registerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Lütfen işaretli alanları düzeltin.", zodFieldErrors(parsed.error.issues));
  const input = parsed.data;

  const problem = passwordProblem(input.password);
  if (problem) return failure(problem, { password: problem });
  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(input.phone);
    if (!phone) return failure("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  }

  const { ipAddress } = await requestMeta();
  if (ipAddress && (await countRecentAttempts(`register:${ipAddress}`, 60 * 60 * 1000)) >= 10) {
    return failure("Bu bağlantıdan çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.");
  }
  if (ipAddress) await recordLoginAttempt(`register:${ipAddress}`, null, false);

  try {
    const user = await registerStudent({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone,
      password: input.password,
      accountType: input.accountType,
      marketingConsent: input.marketing === "on",
    });
    await createSession(user.id);
  } catch (error) {
    if (error instanceof AccountError) return failure(error.message, { email: error.message });
    throw error;
  }
  redirect(safeNextPath(text(formData, "next")) ?? "/hesabim");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email").toLowerCase();
  if (!z.email().safeParse(email).success) return failure("Geçerli bir e-posta adresi yazın.");
  const key = `reset:${email}`;
  if ((await countRecentAttempts(key, 60 * 60 * 1000)) < 5) {
    await recordLoginAttempt(key, null, false);
    await sendPasswordResetEmail(email);
  }
  // Hesabın var olup olmadığını belli etmemek için her durumda aynı mesaj.
  return success("Bu adresle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.");
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = passwordProblem(password);
  if (problem) return failure(problem, { password: problem });
  if (password !== confirm) return failure("Şifreler eşleşmiyor.", { confirm: "Şifreler eşleşmiyor." });

  const userId = await consumeUserToken(token, "PASSWORD_RESET");
  if (!userId) return failure("Bağlantının süresi dolmuş veya daha önce kullanılmış. Yeni bir bağlantı isteyin.");

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password), mustChangePassword: false, emailVerifiedAt: new Date() },
  });
  await db.session.deleteMany({ where: { userId } });
  return success("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
}

export async function changePasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!(await verifyPassword(current, record.passwordHash))) {
    return failure("Mevcut şifreniz hatalı.", { current: "Mevcut şifre hatalı." });
  }
  const problem = passwordProblem(password);
  if (problem) return failure(problem, { password: problem });
  if (password === current) return failure("Yeni şifre eskisiyle aynı olamaz.", { password: "Farklı bir şifre seçin." });
  if (password !== confirm) return failure("Şifreler eşleşmiyor.", { confirm: "Şifreler eşleşmiyor." });

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } });
  await revokeOtherSessions(user.id);

  if (record.mustChangePassword) redirect(roleHome(user.role));
  return success("Şifreniz değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.");
}

export async function verifyEmailAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await consumeUserToken(text(formData, "token"), "EMAIL_VERIFICATION");
  if (!userId) return failure("Doğrulama bağlantısının süresi dolmuş veya daha önce kullanılmış.");
  await db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  return success("E-posta adresiniz doğrulandı. Teşekkürler!");
}

export async function resendVerificationAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return failure("Oturumunuz kapanmış.");
  const key = `verify:${user.id}`;
  if ((await countRecentAttempts(key, 60 * 60 * 1000)) >= 3) return failure("Kısa süre içinde çok fazla istek gönderdiniz.");
  await recordLoginAttempt(key, null, false);
  await sendVerificationEmail(user.id);
  return success("Doğrulama bağlantısı e-posta adresinize gönderildi.");
}

import type { AccountType } from "@/generated/prisma/client";
import { slugify } from "@/lib/text";
import { audit } from "./audit";
import { generateTemporaryPassword, hashPassword } from "./auth/password";
import { issueUserToken } from "./auth/tokens";
import { db } from "./db";
import { renderEmail } from "./email";
import { loadSettings } from "./settings";

export class AccountError extends Error {}

async function uniqueValue(base: string, separator: string, exists: (candidate: string) => Promise<boolean>) {
  const root = base || "kullanici";
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root}${separator}${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new AccountError("Benzersiz değer üretilemedi.");
}

export async function generateUsername(firstName: string, lastName: string) {
  const base = slugify(`${firstName} ${lastName}`).replace(/-/g, ".");
  return uniqueValue(base, "", async (candidate) => Boolean(await db.user.findUnique({ where: { username: candidate } })));
}

export async function generateTeacherSlug(firstName: string, lastName: string) {
  const base = slugify(`${firstName} ${lastName}`);
  return uniqueValue(base, "-", async (candidate) => Boolean(await db.teacherProfile.findUnique({ where: { slug: candidate } })));
}

export type NewTeacherInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  headline?: string | null;
};

export type TeacherAccountResult = { user: { id: string }; username: string | null; temporaryPassword: string | null; upgraded: boolean };

/**
 * Kurum personeli hesabına öğretmen paneli ekler (tek kişi, tek hesap): rol öğretmen olur, kurum üyelikleri ve
 * şifresi aynen kalır. Kurum girişinden kurum panelini, özel ders girişinden öğretmen panelini görür.
 */
async function upgradeCenterUserToTeacher(user: { id: string; email: string | null; username: string | null; firstName: string; lastName: string }, input: NewTeacherInput, adminId: string): Promise<TeacherAccountResult> {
  const slug = await generateTeacherSlug(user.firstName, user.lastName);
  await db.user.update({
    where: { id: user.id },
    data: { role: "TEACHER", phone: input.phone || undefined, teacherProfile: { create: { slug, headline: input.headline?.trim() || null } } },
  });
  await audit({ actorId: adminId, action: "teacher.create", entityType: "User", entityId: user.id, details: { username: user.username, fromCenterAccount: true } });
  if (user.email) {
    const settings = await loadSettings();
    const { html, text } = renderEmail({
      siteName: settings.siteName,
      greetingName: user.firstName,
      title: "Öğretmen paneliniz açıldı",
      lines: [
        `${settings.siteName} öğretmen paneline erişiminiz hazır.`,
        `Kurum hesabınızdaki kullanıcı adı (${user.username ?? user.email}) ve şifrenizle giriş yapın: “Özel ders girişi” öğretmen panelini, “Kurum girişi” kurum panelini açar.`,
        "Giriş yaptıktan sonra profilinizi, derslerinizi, fiyatlarınızı ve müsaitlik takviminizi doldurmanız gerekiyor. Kurumunuz özel ders tarafındaki bilgilerinizi görmez.",
      ],
      action: { label: "Giriş yap", url: "/giris" },
    });
    await db.emailMessage.create({ data: { userId: user.id, to: user.email, subject: `Öğretmen paneliniz açıldı · ${settings.siteName}`, html, text } });
  }
  return { user, username: user.username, temporaryPassword: null, upgraded: true };
}

/**
 * Admin'in "hızlı öğretmen ekle" işlemi: kullanıcı adı ve geçici şifre otomatik üretilir,
 * ilk girişte şifre değiştirme zorunludur. E-posta varsa şifre belirleme bağlantısı gönderilir.
 * E-posta bir kurum personeli hesabına aitse yeni hesap açılmaz, o hesaba öğretmen paneli eklenir.
 */
export async function createTeacherAccount(input: NewTeacherInput, adminId: string): Promise<TeacherAccountResult> {
  const email = input.email?.trim().toLowerCase() || null;
  const existing = email ? await db.user.findUnique({ where: { email } }) : null;
  if (existing?.role === "CENTER") return upgradeCenterUserToTeacher(existing, input, adminId);
  if (existing) throw new AccountError("Bu e-posta adresiyle kayıtlı bir kullanıcı var.");
  let username = input.username?.trim().toLowerCase() || null;
  if (username) {
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new AccountError("Kullanıcı adı 3-40 karakter; harf, rakam, nokta, tire içerebilir.");
    if (await db.user.findUnique({ where: { username } })) throw new AccountError("Bu kullanıcı adı alınmış.");
  } else {
    username = await generateUsername(input.firstName, input.lastName);
  }

  const temporaryPassword = generateTemporaryPassword();
  const slug = await generateTeacherSlug(input.firstName, input.lastName);
  const user = await db.user.create({
    data: {
      role: "TEACHER",
      email,
      username,
      phone: input.phone || null,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      teacherProfile: { create: { slug, headline: input.headline?.trim() || null } },
    },
  });
  await audit({ actorId: adminId, action: "teacher.create", entityType: "User", entityId: user.id, details: { username } });

  if (email) {
    const settings = await loadSettings();
    const token = await issueUserToken(user.id, "PASSWORD_RESET", 3 * 24 * 60 * 60 * 1000);
    const { html, text } = renderEmail({
      siteName: settings.siteName,
      greetingName: user.firstName,
      title: "Öğretmen hesabınız oluşturuldu",
      lines: [
        `${settings.siteName} öğretmen paneline erişiminiz hazır.`,
        `Kullanıcı adınız: ${username}`,
        "Yöneticinin size ilettiği geçici şifreyle giriş yapabilir ya da aşağıdaki bağlantıdan kendi şifrenizi belirleyebilirsiniz (bağlantı 3 gün geçerlidir).",
        "Giriş yaptıktan sonra profilinizi, derslerinizi, fiyatlarınızı ve müsaitlik takviminizi doldurmanız gerekiyor.",
      ],
      action: { label: "Şifremi belirle", url: `/sifre-sifirla/${token}` },
    });
    await db.emailMessage.create({ data: { userId: user.id, to: email, subject: `Öğretmen hesabınız hazır · ${settings.siteName}`, html, text } });
  }

  return { user, username, temporaryPassword, upgraded: false };
}

export type StudentRegistration = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
  accountType: AccountType;
  marketingConsent: boolean;
  /** Davet eden kullanıcı (arkadaşını getir) */
  referredById?: string | null;
};

export async function registerStudent(input: StudentRegistration) {
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    throw new AccountError("Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin.");
  }
  const user = await db.user.create({
    data: {
      role: "STUDENT",
      email,
      phone: input.phone,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      passwordHash: await hashPassword(input.password),
      referredById: input.referredById ?? null,
      studentProfile: {
        create: { accountType: input.accountType, kvkkConsentAt: new Date(), marketingConsent: input.marketingConsent },
      },
    },
  });
  await sendVerificationEmail(user.id);
  return user;
}

export async function sendVerificationEmail(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.email || user.emailVerifiedAt) return;
  const settings = await loadSettings();
  const token = await issueUserToken(user.id, "EMAIL_VERIFICATION");
  const { html, text } = renderEmail({
    siteName: settings.siteName,
    greetingName: user.firstName,
    title: "E-posta adresinizi doğrulayın",
    lines: [`${settings.siteName} hesabınız oluşturuldu.`, "Hesabınızı güvenle kullanmak için e-posta adresinizi doğrulayın."],
    action: { label: "E-postamı doğrula", url: `/eposta-dogrula/${token}` },
  });
  await db.emailMessage.create({ data: { userId: user.id, to: user.email, subject: `E-posta doğrulama · ${settings.siteName}`, html, text } });
}

export async function sendPasswordResetEmail(email: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || user.status !== "ACTIVE" || !user.email) return;
  const settings = await loadSettings();
  const token = await issueUserToken(user.id, "PASSWORD_RESET");
  const { html, text } = renderEmail({
    siteName: settings.siteName,
    greetingName: user.firstName,
    title: "Şifre sıfırlama",
    lines: ["Şifrenizi sıfırlamak için aşağıdaki bağlantıyı kullanın. Bağlantı 1 saat geçerlidir.", "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz."],
    action: { label: "Yeni şifre belirle", url: `/sifre-sifirla/${token}` },
  });
  await db.emailMessage.create({ data: { userId: user.id, to: user.email, subject: `Şifre sıfırlama · ${settings.siteName}`, html, text } });
}

/** Admin bir öğretmenin şifresini sıfırlar: yeni geçici şifre, ilk girişte değiştirme zorunlu. */
export async function resetTeacherPassword(userId: string, adminId: string) {
  const temporaryPassword = generateTemporaryPassword();
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
  });
  await db.session.deleteMany({ where: { userId } });
  await audit({ actorId: adminId, action: "user.password_reset", entityType: "User", entityId: userId });
  return temporaryPassword;
}

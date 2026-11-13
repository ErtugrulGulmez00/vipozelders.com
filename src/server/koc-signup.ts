import "server-only";
import { COACH_DEFAULT_STUDENT_LIMIT, COACH_DISABLED_MODULES } from "@/lib/center/modules";
import { parseCoachTiers } from "@/lib/pi-koc";
import { normalizePhone, normalizePersonName } from "@/lib/text";
import { audit } from "./audit";
import { hashPassword, passwordProblem } from "./auth/password";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { uniqueCenterSlug } from "./center/admin";
import { CenterError } from "./center/errors";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";
import { loadSettings } from "./settings";
import { generateUsername } from "./accounts";

// Pi Koç kendi kendine kayıt: koç formu doldurur, hesabı ücretsiz paketle hemen açılır (yönetici onayı ve deneme süresi yok).
// Ücretli paket ödemesi şimdilik havaleyle alınır; yönetim kurum sayfasından süreyi uzatınca seçilen paket açılır.

export type CoachSignupInput = { firstName: string; lastName: string; email: string; phone: string; password: string; panelName: string | null; students: number };

/** Seçilen ücretli paket (0 ya da geçersiz: ücretsiz başlar, ödeme gelince en küçük ücretli paket açılır). */
async function coachLimit(students: number) {
  const settings = await loadSettings();
  const tiers = parseCoachTiers(settings.piKocTiers);
  const tier = tiers.find((t) => t.students === students) ?? null;
  return { limit: tier?.students ?? tiers[0]?.students ?? COACH_DEFAULT_STUDENT_LIMIT, wantsPaid: Boolean(tier), free: settings.piKocFreeStudents };
}

async function createCoachCenter(userId: string, name: string, students: number, phone: string | null, email: string | null, auto = false) {
  const { limit, wantsPaid, free } = await coachLimit(students);
  const center = await db.center.create({
    data: {
      name,
      slug: await uniqueCenterSlug(name),
      kind: "COACH",
      plan: "STARTER",
      // Ücretsiz paket: süresiz. studentLimit ücretli paketin sınırıdır; ödeme kaydedilince geçerli olur (bkz. coachPlan)
      status: "ACTIVE",
      studentLimit: limit,
      disabledModules: COACH_DISABLED_MODULES,
      phone,
      email,
      members: { create: { userId, role: "OWNER", title: "Koç" } },
    },
  });
  if (auto) {
    // Öğretmene kendiliğinden açılan ücretsiz paket: yönetime bildirim yok, öğretmene site bildirimi
    await notify({
      userId,
      type: "center.koc_welcome",
      title: "Pi Koç hesabınız hazır",
      body: `Öğrencilerinizi Pi Koç'ta takip edin: program, ödev, soru ve deneme takibi, görüntülü ders ve veli raporu. ${free} öğrenciye kadar süresiz ücretsiz.`,
      link: "/koc",
      email: false,
    });
    await audit({ actorId: null, action: "center.koc_auto", entityType: "Center", entityId: center.id, details: { name } });
    return center;
  }
  await notifyRole("ADMIN", { type: "center.koc_signup", title: "Yeni Pi Koç kaydı", body: wantsPaid ? `${name} · ${limit} öğrenci paketini istiyor (ödeme bekleniyor); ücretsiz paketle başladı` : `${name} · ücretsiz paket`, link: `/yonetim/kurumlar/${center.id}`, email: false });
  await notify({
    userId,
    type: "center.koc_welcome",
    title: "Pi Koç'a hoş geldiniz",
    body: wantsPaid
      ? `Hesabınız ücretsiz paketle açıldı (${free} öğrenciye kadar). ${limit} öğrenci paketi, ödemeniz kaydedilince açılır; ödeme bilgisi Hesabım sayfasında.`
      : `Ücretsiz paketle başladınız: ${free} öğrenciye kadar süresiz. İlk öğrencinizi ekleyin; giriş adresiniz pikampus.com/koc-giris.`,
    link: "/koc",
  });
  await audit({ actorId: userId, action: "center.koc_signup", entityType: "Center", entityId: center.id, details: { name, limit } });
  return center;
}

/** Yeni hesapla kayıt: kullanıcı ve Pi Koç hesabı birlikte açılır. Döner: yeni kullanıcının kimliği. */
export async function signupCoach(input: CoachSignupInput, ipAddress: string | null): Promise<string> {
  const problem = passwordProblem(input.password);
  if (problem) throw new CenterError(problem, { password: problem });
  const phone = normalizePhone(input.phone);
  if (!phone) throw new CenterError("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  const email = input.email.trim().toLowerCase();
  if (ipAddress && (await countRecentAttempts(`koc-signup:${ipAddress}`, 60 * 60 * 1000)) >= 5) {
    throw new CenterError("Bu bağlantıdan çok fazla kayıt yapıldı. Lütfen daha sonra tekrar deneyin.");
  }
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new CenterError("Bu e-postayla Pi Kampüs hesabı var. Önce giriş yapın; Pi Koç'u tek tıkla hesabınıza ekleriz.", { email: "E-posta kayıtlı." });
  }
  if (ipAddress) await recordLoginAttempt(`koc-signup:${ipAddress}`, null, false);
  const user = await db.user.create({
    data: {
      role: "CENTER",
      email,
      username: await generateUsername(input.firstName, input.lastName),
      firstName: normalizePersonName(input.firstName),
      lastName: normalizePersonName(input.lastName),
      phone,
      passwordHash: await hashPassword(input.password),
    },
  });
  try {
    await createCoachCenter(user.id, input.panelName || `${input.firstName} ${input.lastName} Koçluk`, input.students, phone, email);
  } catch (error) {
    await db.user.delete({ where: { id: user.id } });
    throw error;
  }
  return user.id;
}

/** Giriş yapmış kişiye (ör. özel ders öğretmeni) Pi Koç hesabı ekler. */
export async function addCoachToUser(user: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; role: string }, panelName: string | null, students: number) {
  if (user.role === "ADMIN") throw new CenterError("Yönetici hesabına Pi Koç eklenmez; kendi hesabınızla kayıt olun.");
  const existing = await db.centerMember.findFirst({ where: { userId: user.id, isActive: true, center: { kind: "COACH" } }, select: { id: true } });
  if (existing) throw new CenterError("Hesabınızda zaten Pi Koç var.");
  return createCoachCenter(user.id, panelName || `${user.firstName} ${user.lastName} Koçluk`, students, user.phone, user.email);
}

/** Her öğretmende Pi Koç ücretsiz paketi hazır olur (hesap açılınca ve toplu açılışta); varsa dokunmaz. */
export async function ensureTeacherCoach(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, firstName: true, lastName: true, phone: true, email: true, status: true } });
  if (!user || user.role !== "TEACHER" || user.status !== "ACTIVE") return null;
  const existing = await db.centerMember.findFirst({ where: { userId, isActive: true, center: { kind: "COACH" } }, select: { centerId: true } });
  if (existing) return null;
  return createCoachCenter(user.id, `${user.firstName} ${user.lastName} Koçluk`, 0, user.phone, user.email, true);
}

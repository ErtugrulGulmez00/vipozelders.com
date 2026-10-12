import { z } from "zod";
import { extendSubscription } from "@/lib/center/subscription";
import { normalizePhone, slugify } from "@/lib/text";
import { audit } from "../audit";
import { countRecentAttempts, recordLoginAttempt } from "../auth/rate-limit";
import { db } from "../db";
import { renderEmail } from "../email";
import { notifyRole } from "../notifications";
import { loadSettings } from "../settings";
import { CenterError } from "./errors";
import { notifyCenterManagers } from "./messages";
import { planStudentLimit, type CenterPlanName } from "./plans";
import { createCenterUser } from "./staff";

// Pi Kampüs yönetimi: kurum açma, plan/süre, abonelik ödemeleri; "Kurumlar için" başvuruları ve vitrin ön kayıtları.

export async function uniqueCenterSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name) || "kurum";
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const existing = await db.center.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return slug;
  }
  throw new CenterError("Kurum adresi üretilemedi.");
}

export type NewCenterInput = {
  name: string;
  kind: "ETUT" | "DERSHANE" | "KURS" | "OTHER";
  cityId: number | null;
  plan: CenterPlanName;
  trialDays: number;
  phone: string | null;
  email: string | null;
  owner: { firstName: string; lastName: string; email: string | null; phone: string | null };
  applicationId: string | null;
};

export async function adminCreateCenter(adminId: string, input: NewCenterInput) {
  const settings = await loadSettings();
  const slug = await uniqueCenterSlug(input.name);
  const center = await db.center.create({
    data: {
      name: input.name,
      slug,
      kind: input.kind,
      cityId: input.cityId,
      plan: input.plan,
      studentLimit: planStudentLimit(input.plan, settings, 0),
      status: "TRIAL",
      trialEndsAt: new Date(Date.now() + Math.max(input.trialDays, 1) * 86_400_000),
      phone: input.phone,
      email: input.email,
    },
  });
  let owner: Awaited<ReturnType<typeof createCenterUser>>;
  try {
    owner = await createCenterUser(center.id, center.name, { ...input.owner, role: "OWNER", title: "Kurum sahibi", branch: null });
  } catch (error) {
    await db.center.delete({ where: { id: center.id } });
    throw error;
  }
  if (input.applicationId) {
    await db.centerApplication.updateMany({ where: { id: input.applicationId }, data: { status: "APPROVED", centerId: center.id, reviewedById: adminId, reviewedAt: new Date() } });
  }
  await audit({ actorId: adminId, action: "center.create", entityType: "Center", entityId: center.id, details: { name: center.name, plan: center.plan } });
  return { center, owner };
}

export type CenterAdminUpdate = {
  name: string;
  kind: "ETUT" | "DERSHANE" | "KURS" | "OTHER";
  plan: CenterPlanName;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED";
  studentLimit: number;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
};

export async function adminUpdateCenter(adminId: string, centerId: string, input: CenterAdminUpdate) {
  const center = await db.center.findUnique({ where: { id: centerId } });
  if (!center) throw new CenterError("Kurum bulunamadı.");
  await db.center.update({ where: { id: centerId }, data: input });
  await audit({ actorId: adminId, action: "center.update", entityType: "Center", entityId: centerId, details: { plan: input.plan, status: input.status, studentLimit: input.studentLimit } });
}

/** Havale/EFT ile gelen abonelik ödemesini kaydeder; süre uzar, kurum aktif olur. */
export async function adminRecordSubscriptionPayment(adminId: string, centerId: string, input: { amount: number; months: number; method: string; reference: string | null; plan: CenterPlanName | null }) {
  const center = await db.center.findUnique({ where: { id: centerId } });
  if (!center) throw new CenterError("Kurum bulunamadı.");
  if (input.months < 1 || input.months > 36) throw new CenterError("Süre 1-36 ay olmalı.");
  const settings = await loadSettings();
  const base = center.status === "TRIAL" ? null : center.paidUntil;
  const { periodStart, periodEnd } = extendSubscription(base, input.months);
  const plan = input.plan ?? center.plan;
  await db.$transaction([
    db.centerSubscriptionPayment.create({ data: { centerId, amount: input.amount, months: input.months, periodStart, periodEnd, method: input.method, reference: input.reference, createdById: adminId } }),
    db.center.update({
      where: { id: centerId },
      data: { status: "ACTIVE", paidUntil: periodEnd, plan, studentLimit: plan === center.plan ? center.studentLimit : planStudentLimit(plan, settings, center.studentLimit) },
    }),
  ]);
  await notifyCenterManagers(centerId, { type: "center.subscription", title: "Aboneliğiniz uzatıldı", body: `${input.months} aylık ödemeniz kaydedildi. Yeni bitiş: ${periodEnd.toLocaleDateString("tr-TR")}`, link: "/kurum/abonelik" });
  await audit({ actorId: adminId, action: "center.subscription_payment", entityType: "Center", entityId: centerId, details: { amount: input.amount, months: input.months } });
  return periodEnd;
}

// ---------------------------------------------------------------------------
// "Kurumlar için" başvuru formu
// ---------------------------------------------------------------------------

export const centerApplicationSchema = z.object({
  centerName: z.string().trim().min(3, "Kurum adını yazın.").max(120),
  kind: z.enum(["ETUT", "DERSHANE", "KURS", "OTHER"]).default("ETUT"),
  contactName: z.string().trim().min(3, "Adınızı ve soyadınızı yazın.").max(80),
  phone: z.string().trim().min(10, "Telefon numaranızı yazın.").max(20),
  email: z.email("Geçerli bir e-posta yazın.").max(120),
  cityId: z.coerce.number().int().min(1).max(81).optional(),
  studentCount: z.string().trim().max(40).optional(),
  message: z.string().trim().max(2000).optional(),
});

export type CenterApplicationInput = z.infer<typeof centerApplicationSchema>;

export async function submitCenterApplication(input: CenterApplicationInput, ipAddress: string | null) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new CenterError("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  if (ipAddress && (await countRecentAttempts(`center-apply:${ipAddress}`, 60 * 60 * 1000)) >= 5) {
    throw new CenterError("Bu bağlantıdan çok fazla başvuru yapıldı. Lütfen daha sonra tekrar deneyin.");
  }
  if (ipAddress) await recordLoginAttempt(`center-apply:${ipAddress}`, null, false);
  const email = input.email.toLowerCase();
  const application = await db.centerApplication.create({
    data: { centerName: input.centerName, kind: input.kind, contactName: input.contactName, phone, email, cityId: input.cityId ?? null, studentCount: input.studentCount || null, message: input.message || null },
  });
  await notifyRole("ADMIN", { type: "center.application", title: "Yeni kurum başvurusu", body: `${input.centerName} · ${input.contactName} · ${phone}`, link: "/yonetim/kurum-basvurulari", email: false });
  const settings = await loadSettings();
  const { html, text } = renderEmail({
    siteName: settings.siteName,
    greetingName: input.contactName.split(" ")[0],
    title: "Kurum paneli başvurunuzu aldık",
    lines: [
      `${input.centerName} için ${settings.siteName} kurum paneli başvurunuz bize ulaştı.`,
      "Ekibimiz en kısa sürede sizi arayıp paneli birlikte kuracak; ücretsiz deneme süreniz hesabınız açıldığı gün başlar.",
    ],
  });
  await db.emailMessage.create({ data: { to: email, subject: `Başvurunuz alındı · ${settings.siteName}`, html, text } });
  return application;
}

export async function setCenterApplicationStatus(adminId: string, applicationId: string, status: "NEW" | "REJECTED", note: string | null) {
  await db.centerApplication.update({ where: { id: applicationId }, data: { status, note, reviewedById: adminId, reviewedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Vitrin sayfasından ön kayıt
// ---------------------------------------------------------------------------

export const leadSchema = z.object({
  studentName: z.string().trim().min(3, "Öğrencinin adını ve soyadını yazın.").max(80),
  parentName: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(10, "Telefon numaranızı yazın.").max(20),
  email: z.union([z.literal(""), z.email("Geçerli bir e-posta yazın.")]).optional(),
  gradeName: z.string().trim().max(40).optional(),
  message: z.string().trim().max(1000).optional(),
});

export async function submitLead(slug: string, input: z.infer<typeof leadSchema>, ipAddress: string | null) {
  const center = await db.center.findUnique({ where: { slug }, select: { id: true, name: true, isPublic: true, status: true } });
  if (!center || !center.isPublic || center.status === "SUSPENDED") throw new CenterError("Kurum bulunamadı.");
  const phone = normalizePhone(input.phone);
  if (!phone) throw new CenterError("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  if (ipAddress && (await countRecentAttempts(`lead:${ipAddress}`, 60 * 60 * 1000)) >= 5) throw new CenterError("Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.");
  if (ipAddress) await recordLoginAttempt(`lead:${ipAddress}`, null, false);
  await db.centerLead.create({
    data: { centerId: center.id, studentName: input.studentName, parentName: input.parentName || null, phone, email: input.email || null, gradeName: input.gradeName || null, message: input.message || null, source: "web" },
  });
  await notifyCenterManagers(center.id, { type: "center.lead", title: "Yeni ön kayıt", body: `${input.studentName}${input.gradeName ? ` (${input.gradeName})` : ""} · ${phone}`, link: "/kurum/on-kayit" });
  return center;
}

import { z } from "zod";
import { normalizePhone } from "@/lib/text";
import { AccountError, createTeacherAccount } from "./accounts";
import { audit } from "./audit";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { db } from "./db";
import { renderEmail } from "./email";
import { notifyRole } from "./notifications";
import { loadSettings } from "./settings";

// "Öğretmen olarak katılın" başvuruları: herkese açık form → yönetici inceler → tek tıkla öğretmen hesabı.

export class ApplicationError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string>) {
    super(message);
  }
}

export const applicationSchema = z.object({
  firstName: z.string().trim().min(2, "Adınızı yazın.").max(50),
  lastName: z.string().trim().min(2, "Soyadınızı yazın.").max(50),
  email: z.email("Geçerli bir e-posta adresi yazın.").max(120),
  phone: z.string().trim().min(10, "Cep telefonunuzu yazın.").max(20),
  cityId: z.coerce.number().int().min(1).max(81).optional(),
  subjects: z.string().trim().min(3, "Hangi ders ve kademelerde ders verdiğinizi yazın.").max(300),
  experienceYears: z.coerce.number().int().min(0).max(60).default(0),
  education: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
  offersOnline: z.boolean().default(true),
  offersInPerson: z.boolean().default(false),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

async function queueEmail(to: string, greetingName: string, title: string, lines: string[]) {
  const { siteName } = await loadSettings();
  const { html, text } = renderEmail({ siteName, greetingName, title, lines });
  await db.emailMessage.create({ data: { to, subject: `${title} · ${siteName}`, html, text } });
}

export async function submitTeacherApplication(input: ApplicationInput, ipAddress: string | null) {
  const email = input.email.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ApplicationError("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  if (!input.offersOnline && !input.offersInPerson) throw new ApplicationError("Online, yüz yüze ya da ikisini birden seçin.");

  if (ipAddress && (await countRecentAttempts(`apply:${ipAddress}`, 60 * 60 * 1000)) >= 5) {
    throw new ApplicationError("Bu bağlantıdan çok fazla başvuru yapıldı. Lütfen daha sonra tekrar deneyin.");
  }
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new ApplicationError("Bu e-posta adresiyle zaten bir hesap var. Giriş yapmayı deneyin ya da bizimle iletişime geçin.", { email: "Bu e-posta kayıtlı." });
  }
  if (await db.teacherApplication.findFirst({ where: { email, status: "NEW" }, select: { id: true } })) {
    throw new ApplicationError("Bu e-posta adresiyle yapılmış bir başvurunuz zaten inceleniyor. En kısa sürede size dönüş yapacağız.");
  }
  if (ipAddress) await recordLoginAttempt(`apply:${ipAddress}`, null, false);

  const application = await db.teacherApplication.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      phone,
      cityId: input.cityId ?? null,
      subjects: input.subjects,
      experienceYears: input.experienceYears,
      education: input.education || null,
      message: input.message || null,
      offersOnline: input.offersOnline,
      offersInPerson: input.offersInPerson,
    },
  });
  await notifyRole("ADMIN", {
    type: "teacher.application",
    title: "Yeni öğretmen başvurusu",
    body: `${input.firstName} ${input.lastName} · ${input.subjects}`,
    link: "/yonetim/basvurular",
    email: false,
  });
  await queueEmail(email, input.firstName, "Başvurunuzu aldık", [
    "Öğretmen başvurunuz için teşekkür ederiz.",
    "Ekibimiz bilgilerinizi inceleyip birkaç gün içinde telefon veya e-postayla size dönüş yapacak.",
    "Başvurunuz onaylanırsa öğretmen paneli giriş bilgileriniz bu adrese gönderilir.",
  ]);
  return application;
}

/** Başvurudan öğretmen hesabı açar; başvurudaki deneyim, şehir ve ders şekli profile aktarılır. */
export async function approveApplication(applicationId: string, adminId: string) {
  const application = await db.teacherApplication.findUnique({ where: { id: applicationId } });
  if (!application) throw new ApplicationError("Başvuru bulunamadı.");
  if (application.status !== "NEW") throw new ApplicationError("Bu başvuru zaten sonuçlandırılmış.");

  let result: Awaited<ReturnType<typeof createTeacherAccount>>;
  try {
    result = await createTeacherAccount({ firstName: application.firstName, lastName: application.lastName, email: application.email, phone: application.phone }, adminId);
  } catch (error) {
    if (error instanceof AccountError) throw new ApplicationError(error.message);
    throw error;
  }
  await db.$transaction([
    db.teacherProfile.update({
      where: { userId: result.user.id },
      data: {
        experienceYears: application.experienceYears,
        education: application.education,
        cityId: application.cityId,
        offersOnline: application.offersOnline,
        offersInPerson: application.offersInPerson,
      },
    }),
    db.teacherApplication.update({ where: { id: application.id }, data: { status: "APPROVED", teacherId: result.user.id, reviewedById: adminId, reviewedAt: new Date() } }),
  ]);
  await audit({ actorId: adminId, action: "application.approved", entityType: "TeacherApplication", entityId: application.id, details: { teacherId: result.user.id } });
  return result;
}

/** Başvuruyu reddeder; not yalnızca yönetim içindir, adaya kibar bir bilgilendirme gider. */
export async function rejectApplication(applicationId: string, adminId: string, note: string) {
  const application = await db.teacherApplication.findUnique({ where: { id: applicationId } });
  if (!application) throw new ApplicationError("Başvuru bulunamadı.");
  if (application.status !== "NEW") throw new ApplicationError("Bu başvuru zaten sonuçlandırılmış.");
  await db.teacherApplication.update({ where: { id: application.id }, data: { status: "REJECTED", note: note.trim().slice(0, 500) || null, reviewedById: adminId, reviewedAt: new Date() } });
  await queueEmail(application.email, application.firstName, "Öğretmen başvurunuz hakkında", [
    "Başvurunuz ve ilginiz için teşekkür ederiz.",
    "Şu an için başvurunuzu kabul edemiyoruz. İlerleyen dönemde yeni kademe ve derslerde öğretmen aradığımızda sizinle yeniden iletişime geçebiliriz.",
  ]);
  await audit({ actorId: adminId, action: "application.rejected", entityType: "TeacherApplication", entityId: application.id });
}

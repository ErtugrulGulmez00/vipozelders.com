import "server-only";
import { z } from "zod";
import { maskContacts, normalizePhone } from "@/lib/text";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";
import { loadSettings } from "./settings";
import { coachPlan } from "@/lib/pi-koc";
import { nextStudentNumber } from "./center/students";
import { addCoachToUser } from "./koc-signup";

// Vitrinden öğretmene doğrudan ders talebi (2026-11-12 modeli): platform ödemeye aracılık etmez. Veli talebi
// gönderir; öğretmen kabul edince velinin telefonunu görür ve ücret, saat gibi ayrıntıları veliyle kendisi konuşur.

export class InquiryError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Vitrinden randevu ve ödeme açık mı (kapalıyken profilde ders talebi formu görünür). */
export async function lessonBookingOpen(): Promise<boolean> {
  return (await loadSettings()).lessonBookingEnabled;
}

export const inquirySchema = z.object({
  teacherId: z.string().min(1),
  name: z.string().trim().min(3, "Adınızı ve soyadınızı yazın.").max(80),
  phone: z.string().trim().min(10, "Telefon numaranızı yazın."),
  studentName: z.string().trim().max(80).optional(),
  gradeName: z.string().trim().max(40).optional(),
  offeringId: z.string().trim().max(40).optional(),
  mode: z.enum(["online", "yuz-yuze", "farketmez"]).default("farketmez"),
  preferredTimes: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

/** Bir hesabın günde gönderebileceği en fazla talep */
const DAILY_LIMIT = 5;

export const INQUIRY_MODE_LABEL: Record<string, string> = { online: "Online", "yuz-yuze": "Yüz yüze", farketmez: "Online ya da yüz yüze" };

export async function submitInquiry(input: InquiryInput, requester: { id: string; email: string | null }, ipAddress: string | null) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new InquiryError("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: input.teacherId },
    select: { userId: true, slug: true, status: true, user: { select: { status: true, firstName: true } }, offerings: { where: { isActive: true }, select: { id: true, level: { select: { name: true } }, subject: { select: { name: true } } } } },
  });
  if (!teacher || teacher.status !== "PUBLISHED" || teacher.user.status !== "ACTIVE") throw new InquiryError("Bu öğretmen şu an talep kabul etmiyor.");
  if (teacher.userId === requester.id) throw new InquiryError("Kendinize talep gönderemezsiniz.");
  if ((await countRecentAttempts(`inquiry:${requester.id}`, 86_400_000)) >= DAILY_LIMIT) {
    throw new InquiryError("Bugün çok fazla talep gönderdiniz. Öğretmenlerin dönüşünü bekleyin ya da yarın tekrar deneyin.");
  }
  const open = await db.teacherInquiry.findFirst({ where: { teacherId: teacher.userId, requesterId: requester.id, status: "PENDING" }, select: { id: true } });
  if (open) throw new InquiryError(`${teacher.user.firstName} Hoca'ya gönderdiğiniz talep henüz yanıtlanmadı. Yanıt gelince size haber vereceğiz.`);

  const offering = input.offeringId ? teacher.offerings.find((o) => o.id === input.offeringId) : null;
  await recordLoginAttempt(`inquiry:${requester.id}`, ipAddress, false);
  const inquiry = await db.teacherInquiry.create({
    data: {
      teacherId: teacher.userId,
      requesterId: requester.id,
      name: input.name,
      phone,
      email: requester.email,
      studentName: input.studentName || null,
      gradeName: input.gradeName || null,
      offeringId: offering?.id ?? null,
      lessonName: offering ? `${offering.level.name} · ${offering.subject.name}` : null,
      mode: input.mode,
      // İletişim bilgisi yalnızca kabulden sonra görünür; serbest metindeki numara gizlenir
      preferredTimes: input.preferredTimes ? maskContacts(input.preferredTimes) : null,
      note: input.note ? maskContacts(input.note) : null,
      ipAddress,
    },
  });
  const lesson = inquiry.lessonName ?? "Ders belirtilmedi";
  await notify({
    userId: teacher.userId,
    type: "inquiry.new",
    title: `Yeni ders talebi: ${lesson}`,
    body: `${inquiry.studentName ? `${inquiry.studentName} için · ` : ""}${INQUIRY_MODE_LABEL[inquiry.mode]}${inquiry.preferredTimes ? ` · ${inquiry.preferredTimes}` : ""}. Kabul ederseniz velinin telefonunu görürsünüz.`,
    link: "/ogretmen-paneli/ders-talepleri",
  });
  await notifyRole("ADMIN", { type: "admin.inquiry", title: `Ders talebi → ${teacher.user.firstName} (${teacher.slug})`, body: lesson, link: `/ogretmen/${teacher.slug}`, email: false });
  return inquiry;
}

/** Öğretmen talebi kabul eder ya da geri çevirir; veliye haber verilir. */
export async function respondInquiry(teacherId: string, inquiryId: string, accept: boolean) {
  const inquiry = await db.teacherInquiry.findFirst({ where: { id: inquiryId, teacherId }, include: { teacher: { select: { firstName: true, lastName: true, teacherProfile: { select: { slug: true } } } } } });
  if (!inquiry) throw new InquiryError("Talep bulunamadı.");
  if (inquiry.status !== "PENDING") throw new InquiryError("Bu talep zaten yanıtlandı.");
  const updated = await db.teacherInquiry.updateMany({ where: { id: inquiry.id, status: "PENDING" }, data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date() } });
  if (!updated.count) throw new InquiryError("Bu talep zaten yanıtlandı.");
  const teacherName = `${inquiry.teacher.firstName} ${inquiry.teacher.lastName.charAt(0)}.`;
  if (inquiry.requesterId) {
    await notify({
      userId: inquiry.requesterId,
      type: accept ? "inquiry.accepted" : "inquiry.declined",
      title: accept ? `${teacherName} ders talebinizi kabul etti` : `${teacherName} şu an yeni öğrenci alamıyor`,
      body: accept
        ? `Öğretmen sizi ${inquiry.phone} numarasından arayacak. Ders saatini ve ücreti öğretmenle birlikte belirlersiniz.`
        : "Talebiniz için teşekkür ederiz. Aynı derste başka öğretmenlere göz atabilirsiniz.",
      link: accept && inquiry.teacher.teacherProfile ? `/ogretmen/${inquiry.teacher.teacherProfile.slug}` : "/ogretmenler",
    });
  }
  return { ...inquiry, status: accept ? ("ACCEPTED" as const) : ("DECLINED" as const) };
}

export type CoachLinkResult =
  | { added: true; studentId: string; createdCoach: boolean }
  | { added: false; reason: string; createdCoach: boolean };

/** "Deniz Kaya" → ["Deniz", "Kaya"]; tek kelimede soyadı velinin soyadından alınır. */
function splitName(student: string | null, parent: string): [string, string] {
  const words = (student ?? "").trim().split(/\s+/).filter(Boolean);
  const parentLast = parent.trim().split(/\s+/).filter(Boolean).at(-1) ?? "";
  if (words.length >= 2) return [words.slice(0, -1).join(" "), words.at(-1)!];
  return [words[0] ?? "Öğrenci", parentLast || "-"];
}

/**
 * Kabul edilen talebin öğrencisini öğretmenin Pi Koç'una ekler (adım 5). Öğretmenin Pi Koç hesabı yoksa ücretsiz
 * paketle açılır. Talebi gönderen veli hesabı öğrenciye veli olarak bağlanır; veli programı ve raporları /kocum'da görür.
 * Paket sınırı doluysa öğrenci eklenmez, neden döner (öğretmen yer açınca tekrar dener).
 */
export async function addInquiryToCoach(teacherId: string, inquiryId: string): Promise<CoachLinkResult> {
  const inquiry = await db.teacherInquiry.findFirst({ where: { id: inquiryId, teacherId } });
  if (!inquiry) throw new InquiryError("Talep bulunamadı.");
  if (inquiry.status !== "ACCEPTED") throw new InquiryError("Önce talebi kabul edin.");
  if (inquiry.centerStudentId) return { added: true, studentId: inquiry.centerStudentId, createdCoach: false };

  let createdCoach = false;
  let member = await db.centerMember.findFirst({
    where: { userId: teacherId, isActive: true, role: "OWNER", center: { kind: "COACH", status: { not: "SUSPENDED" } } },
    select: { id: true, center: { select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true } } },
  });
  if (!member) {
    const teacher = await db.user.findUniqueOrThrow({ where: { id: teacherId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true } });
    await addCoachToUser(teacher, null, 0);
    createdCoach = true;
    member = await db.centerMember.findFirstOrThrow({
      where: { userId: teacherId, isActive: true, role: "OWNER", center: { kind: "COACH" } },
      select: { id: true, center: { select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true } } },
    });
  }
  const { center } = member;
  const coachId = member.id;
  const limit = coachPlan(center, (await loadSettings()).piKocFreeStudents).studentLimit;
  const [firstName, lastName] = splitName(inquiry.studentName, inquiry.name);
  const notes = [`Vitrinden ders talebi${inquiry.lessonName ? `: ${inquiry.lessonName}` : ""}`, inquiry.preferredTimes ? `Uygun saatler: ${inquiry.preferredTimes}` : null, inquiry.note].filter(Boolean).join("\n");

  const result = await db.$transaction(async (tx) => {
    // Aynı anda iki kabul sınırı aşmasın
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`koc-capacity:${center.id}`}))`;
    const active = await tx.centerStudent.count({ where: { centerId: center.id, status: "ACTIVE" } });
    if (active >= limit) return null;
    const student = await tx.centerStudent.create({
      data: {
        centerId: center.id,
        studentNumber: await nextStudentNumber(center.id, tx),
        firstName,
        lastName,
        gradeName: inquiry.gradeName,
        notes,
        coachId,
        guardians: {
          create: { centerId: center.id, fullName: inquiry.name, relation: "Veli", phone: inquiry.phone, email: inquiry.email, userId: inquiry.requesterId, isPrimary: true, notifyEmail: Boolean(inquiry.email), notifyWhatsapp: false },
        },
      },
    });
    await tx.teacherInquiry.update({ where: { id: inquiry.id }, data: { centerStudentId: student.id } });
    return student;
  });
  if (!result) {
    return { added: false, createdCoach, reason: `Pi Koç paketinizin öğrenci sınırı (${limit}) dolu. Bir öğrenciyi arşive alın ya da paketinizi yükseltin, sonra “Pi Koç'a ekle” deyin.` };
  }
  if (inquiry.requesterId) {
    await notify({
      userId: inquiry.requesterId,
      type: "inquiry.coach_linked",
      title: `${firstName}, ${center.name} takibine eklendi`,
      body: "Haftalık program, ödevler, deneme sonuçları ve koçluk raporları hesabınızda “Koçum” bölümünde görünür.",
      link: "/kocum",
    });
  }
  return { added: true, studentId: result.id, createdCoach };
}

export async function teacherInquiries(teacherId: string) {
  return db.teacherInquiry.findMany({ where: { teacherId }, orderBy: [{ createdAt: "desc" }], take: 100 });
}

export async function pendingInquiryCount(teacherId: string) {
  return db.teacherInquiry.count({ where: { teacherId, status: "PENDING" } });
}

/** Velinin gönderdiği ders talepleri (Hesabım → Ders taleplerim). */
export async function requesterInquiries(requesterId: string) {
  return db.teacherInquiry.findMany({
    where: { requesterId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { teacher: { select: { firstName: true, lastName: true, teacherProfile: { select: { slug: true } } } }, review: { select: { id: true } } },
  });
}

export async function pendingRequesterInquiryCount(requesterId: string) {
  return db.teacherInquiry.count({ where: { requesterId, status: "PENDING" } });
}

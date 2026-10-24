import { z } from "zod";
import { maskContacts, normalizePhone } from "@/lib/text";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { db } from "./db";
import { notifyRole } from "./notifications";

// Öğretmen talebi: veli aradığı öğretmeni bulamazsa ders, kademe ve uygun saatlerini bırakır. Yönetici talebi
// görür ve veliye döner; o derste ders veren öğretmenlere iletişim bilgisi olmadan haber verilir.

export class LessonRequestError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export const lessonRequestSchema = z.object({
  name: z.string().trim().min(2, "Adınızı yazın.").max(80),
  phone: z.string().trim().min(10, "Telefon numaranızı yazın."),
  email: z.string().trim().email("Geçerli bir e-posta yazın.").max(120).optional(),
  levelId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  mode: z.enum(["online", "yuz-yuze", "farketmez"]).default("farketmez"),
  cityName: z.string().trim().max(60).optional(),
  preferredTimes: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
});

export type LessonRequestInput = z.infer<typeof lessonRequestSchema>;

const TEACHER_NOTIFY_LIMIT = 30;

export async function submitLessonRequest(input: LessonRequestInput, studentId: string | null, ipAddress: string | null) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new LessonRequestError("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz telefon numarası." });
  if (ipAddress && (await countRecentAttempts(`talep:${ipAddress}`, 60 * 60 * 1000)) >= 5) {
    throw new LessonRequestError("Bu bağlantıdan çok fazla talep gönderildi. Lütfen daha sonra tekrar deneyin.");
  }
  const pair = input.levelId && input.subjectId ? await db.levelSubject.findUnique({ where: { levelId_subjectId: { levelId: input.levelId, subjectId: input.subjectId } }, include: { level: true, subject: true } }) : null;
  const level = !pair && input.levelId ? await db.level.findUnique({ where: { id: input.levelId } }) : pair?.level ?? null;
  if (ipAddress) await recordLoginAttempt(`talep:${ipAddress}`, null, false);

  const request = await db.lessonRequest.create({
    data: {
      studentId,
      name: input.name,
      phone,
      email: input.email?.toLowerCase() || null,
      levelId: level?.id ?? null,
      subjectId: pair?.subjectId ?? null,
      levelName: level?.name ?? null,
      subjectName: pair?.subject.name ?? null,
      mode: input.mode,
      cityName: input.cityName || null,
      preferredTimes: input.preferredTimes ? maskContacts(input.preferredTimes) : null,
      note: input.note ? maskContacts(input.note) : null,
      ipAddress,
    },
  });

  const lesson = [request.levelName, request.subjectName].filter(Boolean).join(" ") || "Ders belirtilmedi";
  await notifyRole("ADMIN", { type: "admin.lesson_request", title: `Yeni öğretmen talebi: ${lesson}`, body: `${request.name} · ${request.mode === "yuz-yuze" ? `yüz yüze${request.cityName ? ` (${request.cityName})` : ""}` : request.mode === "online" ? "online" : "online ya da yüz yüze"}${request.preferredTimes ? ` · ${request.preferredTimes}` : ""}`, link: "/yonetim/talepler", email: true });

  // O kademe/derste ders veren yayındaki öğretmenlere haber (iletişim bilgisi yok)
  if (request.levelId && request.subjectId) {
    const teachers = await db.teacherProfile.findMany({
      where: { status: "PUBLISHED", user: { status: "ACTIVE" }, offerings: { some: { isActive: true, levelId: request.levelId, subjectId: request.subjectId } } },
      select: { userId: true },
      take: TEACHER_NOTIFY_LIMIT,
    });
    if (teachers.length) {
      await db.notification.createMany({
        data: teachers.map((t) => ({
          userId: t.userId,
          type: "lesson_request",
          title: `${lesson} için öğrenci arıyor`,
          body: `${request.preferredTimes ? `Uygun saatler: ${request.preferredTimes}. ` : ""}Takviminizde bu saatlerde boşluk açın ve ücretsiz tanışma görüşmesini etkinleştirin; ekibimiz veliye sizi önerecek.`,
          link: "/ogretmen-paneli/takvim",
        })),
      });
      await db.lessonRequest.update({ where: { id: request.id }, data: { notifiedTeachers: teachers.length } });
    }
  }
  return request;
}

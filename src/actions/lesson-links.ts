"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { isDateString, timeToMinutes, zonedDateTime } from "@/lib/dates";
import { audit } from "@/server/audit";
import { getCurrentUser, actionUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { appUrl } from "@/server/email";
import { cancelLessonLink, claimLessonLink, createLessonLink, LessonLinkError, openQuestionSession } from "@/server/lesson-links";
import { TEACHERS_CACHE_TAG } from "@/server/teachers";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Öğretmenin "dersle birlikte 30 dakika soru çözümü" taahhüdünü açar ya da kapatır. */
export async function saveQuestionSessionOfferAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const offers = formData.get("offersQuestionSession") === "on";
  await db.teacherProfile.update({ where: { userId: user.id }, data: { offersQuestionSession: offers } });
  await audit({ actorId: user.id, action: "teacher.question_session_offer", entityType: "TeacherProfile", entityId: user.id, details: { offers } });
  updateTag(TEACHERS_CACHE_TAG);
  refresh();
  return success(offers ? "Açıldı. Profilinizde görünür; bundan sonra alınan dersler için geçerli." : "Kapatıldı. Daha önce alınmış derslerin hakları durur.");
}

export async function openQuestionSessionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const date = text(formData, "date");
  const minutes = timeToMinutes(text(formData, "time"));
  if (!isDateString(date) || minutes === null) return failure("Ders gününü ve saatini seçin.", { date: "Gün ve saat gerekli." });
  try {
    await openQuestionSession({ teacherId: user.id, sourceBookingId: text(formData, "bookingId"), startAt: zonedDateTime(date, minutes) });
  } catch (error) {
    if (error instanceof LessonLinkError) return failure(error.message);
    throw error;
  }
  // Hakkı kullanılan satır listeden kalktığı için mesaj yönlendirilen sayfada gösterilir
  redirect("/ogretmen-paneli/soru-cozum?durum=soru-cozum");
}

export async function createLessonLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const date = text(formData, "date");
  const minutes = timeToMinutes(text(formData, "time"));
  if (!isDateString(date) || minutes === null) return failure("Ders gününü ve saatini seçin.", { date: "Gün ve saat gerekli." });
  try {
    const link = await createLessonLink({
      teacherId: user.id,
      startAt: zonedDateTime(date, minutes),
      durationMinutes: Number(formData.get("duration") ?? 60),
      offeringId: text(formData, "offeringId") || null,
      sourceBookingId: text(formData, "sourceBookingId") || null,
      note: text(formData, "note") || null,
    });
    refresh();
    return success(link.sourceBookingId ? "Telafi bağlantısı hazır; öğrenciye bildirim gönderildi." : "Bağlantı hazır. Kopyalayıp öğrencinize gönderin.", { url: appUrl(`/ders-baglantisi/${link.token}`) });
  } catch (error) {
    if (error instanceof LessonLinkError) return failure(error.message);
    throw error;
  }
}

export async function cancelLessonLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    await cancelLessonLink(text(formData, "linkId"), user.id);
  } catch (error) {
    if (error instanceof LessonLinkError) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Bağlantı iptal edildi.");
}

export async function claimLessonLinkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = text(formData, "token");
  const user = await getCurrentUser();
  if (!user) redirect(`/giris?next=${encodeURIComponent(`/ders-baglantisi/${token}`)}`);
  if (user.mustChangePassword) redirect("/sifre-degistir");
  let bookingId: string;
  try {
    bookingId = (await claimLessonLink(token, user.id)).id;
  } catch (error) {
    if (error instanceof LessonLinkError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/derslerim/${bookingId}?durum=baglanti`);
}

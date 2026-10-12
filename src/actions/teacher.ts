"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { audit } from "@/server/audit";
import { actionUser } from "@/server/auth/current-user";
import { approveBooking, BookingError, cancelByTeacher, rejectBooking } from "@/server/bookings";
import { notifyRole } from "@/server/notifications";
import { ReviewError, replyToReview } from "@/server/reviews";
import { UploadError } from "@/server/storage";
import { deleteTeacherDocument, DocumentError, uploadTeacherDocument } from "@/server/teacher-documents";
import {
  addAvailabilityException,
  ProfileError,
  removeAvailabilityException,
  removeOffering,
  removeTeacherPhoto,
  saveAvailability,
  saveOffering,
  savePayoutInfo,
  updateTeacherPhoto,
  updateTeacherProfile,
} from "@/server/teacher-profile";
import { profileChecklist, TEACHERS_CACHE_TAG } from "@/server/teachers";
import { db } from "@/server/db";
import { normalizePhone } from "@/lib/text";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/**
 * Düzenlenecek öğretmen: öğretmen kendi profilini, yönetici formdaki teacherId'yi düzenler.
 * Yetkisiz istekte null döner.
 */
async function resolveTarget(formData: FormData): Promise<{ teacherId: string; actorId: string; isAdmin: boolean } | null> {
  const user = await actionUser("TEACHER", "ADMIN");
  if (!user) return null;
  if (user.role === "TEACHER") return { teacherId: user.id, actorId: user.id, isAdmin: false };
  const teacherId = text(formData, "teacherId");
  const exists = teacherId ? await db.teacherProfile.findUnique({ where: { userId: teacherId }, select: { userId: true } }) : null;
  return exists ? { teacherId, actorId: user.id, isAdmin: true } : null;
}

function handle(error: unknown): ActionState {
  if (error instanceof ProfileError) return failure(error.message, error.fieldErrors);
  if (error instanceof BookingError || error instanceof ReviewError || error instanceof UploadError) return failure(error.message);
  throw error;
}

export async function saveProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = await resolveTarget(formData);
  if (!target) return failure("Bu işlem için yetkiniz yok.");
  try {
    await updateTeacherProfile(target.teacherId, formData);
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) await updateTeacherPhoto(target.teacherId, photo);
    if (target.isAdmin) await audit({ actorId: target.actorId, action: "teacher.profile_update", entityType: "TeacherProfile", entityId: target.teacherId });
  } catch (error) {
    return handle(error);
  }
  updateTag(TEACHERS_CACHE_TAG);
  refresh();
  return success("Profil kaydedildi.");
}

export async function removePhotoAction(formData: FormData) {
  const target = await resolveTarget(formData);
  if (!target) return;
  await removeTeacherPhoto(target.teacherId);
  refresh();
}

export async function saveOfferingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = await resolveTarget(formData);
  if (!target) return failure("Bu işlem için yetkiniz yok.");
  try {
    await saveOffering(target.teacherId, formData);
  } catch (error) {
    return handle(error);
  }
  updateTag(TEACHERS_CACHE_TAG);
  refresh();
  return success("Ders ve fiyat kaydedildi.");
}

export async function removeOfferingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = await resolveTarget(formData);
  if (!target) return failure("Bu işlem için yetkiniz yok.");
  try {
    await removeOffering(target.teacherId, text(formData, "offeringId"));
  } catch (error) {
    return handle(error);
  }
  updateTag(TEACHERS_CACHE_TAG);
  refresh();
  return success("Ders kaldırıldı.");
}

export async function saveAvailabilityAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = await resolveTarget(formData);
  if (!target) return failure("Bu işlem için yetkiniz yok.");
  try {
    await saveAvailability(target.teacherId, text(formData, "rules"), Number(formData.get("bufferMinutes") ?? 0));
  } catch (error) {
    return handle(error);
  }
  refresh();
  return success("Haftalık takviminiz kaydedildi.");
}

export async function addExceptionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = await resolveTarget(formData);
  if (!target) return failure("Bu işlem için yetkiniz yok.");
  try {
    await addAvailabilityException(target.teacherId, formData);
  } catch (error) {
    return handle(error);
  }
  refresh();
  return success("Eklendi.");
}

export async function removeExceptionAction(formData: FormData) {
  const target = await resolveTarget(formData);
  if (!target) return;
  await removeAvailabilityException(target.teacherId, text(formData, "exceptionId"));
  refresh();
}

export async function savePayoutAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const target = await resolveTarget(formData);
  if (!target) return failure("Bu işlem için yetkiniz yok.");
  try {
    await savePayoutInfo(target.teacherId, formData);
    await audit({ actorId: target.actorId, action: "teacher.payout_info_update", entityType: "TeacherProfile", entityId: target.teacherId });
  } catch (error) {
    return handle(error);
  }
  refresh();
  return success("Ödeme bilgileriniz kaydedildi.");
}

export async function requestPublishAction(): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const checklist = await profileChecklist(user.id);
  if (!checklist.complete) return failure("Önce eksik adımları tamamlayın.");
  await notifyRole("ADMIN", {
    type: "admin.publish_request",
    title: "Öğretmen yayın onayı bekliyor",
    body: `${user.firstName} ${user.lastName} profilini tamamladı ve yayına alınmayı bekliyor.`,
    link: `/yonetim/ogretmenler/${user.id}`,
  });
  return success("Talebiniz yöneticiye iletildi. Profiliniz incelendikten sonra yayına alınacak.");
}

export async function approveRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const bookingId = text(formData, "bookingId");
  try {
    await approveBooking(bookingId, user.id);
  } catch (error) {
    return handle(error);
  }
  redirect(`/ogretmen-paneli/dersler/${bookingId}?durum=onaylandi`);
}

export async function rejectRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = [text(formData, "reasonPreset"), text(formData, "reason")].filter(Boolean).join(" — ");
  if (reason.length < 3) return failure("Öğrenciye iletilecek kısa bir gerekçe seçin veya yazın.");
  try {
    await rejectBooking(text(formData, "bookingId"), user.id, reason.slice(0, 300));
  } catch (error) {
    return handle(error);
  }
  redirect("/ogretmen-paneli/talepler?durum=reddedildi");
}

export async function teacherCancelAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = text(formData, "reason");
  if (reason.length < 5) return failure("Öğrenciye iletilecek iptal gerekçesini yazın.");
  const bookingId = text(formData, "bookingId");
  try {
    await cancelByTeacher(bookingId, user.id, reason.slice(0, 300));
  } catch (error) {
    return handle(error);
  }
  redirect(`/ogretmen-paneli/dersler/${bookingId}?durum=ogretmen-iptal`);
}

export async function replyReviewAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    await replyToReview(text(formData, "reviewId"), user.id, text(formData, "reply"));
  } catch (error) {
    return handle(error);
  }
  refresh();
  return success("Yanıtınız yayınlandı.");
}

export async function updateTeacherContactAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const phoneInput = text(formData, "phone");
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && !phone) return failure("Telefon numarası 05XX XXX XX XX biçiminde olmalı.");
  await db.user.update({ where: { id: user.id }, data: { phone } });
  refresh();
  return success("İletişim bilgileriniz güncellendi.");
}

// ---------------------------------------------------------------------------
// Belgeler (kimlik, diploma, adli sicil…)
// ---------------------------------------------------------------------------

export async function uploadDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const file = formData.get("file");
  try {
    await uploadTeacherDocument(user.id, text(formData, "type"), file instanceof File ? file : null);
  } catch (error) {
    if (error instanceof DocumentError) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Belgeniz yüklendi; yönetici inceledikten sonra size bildirim gelecek.");
}

export async function deleteDocumentAction(formData: FormData) {
  const user = await actionUser("TEACHER");
  if (!user) return;
  await deleteTeacherDocument(user.id, text(formData, "documentId")).catch((error: unknown) => {
    if (!(error instanceof DocumentError)) throw error;
  });
  refresh();
}

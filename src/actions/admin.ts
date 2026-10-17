"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { parseMoneyInput } from "@/lib/money";
import { normalizePhone, slugify } from "@/lib/text";
import { AccountError, createTeacherAccount, resetTeacherPassword } from "@/server/accounts";
import { audit } from "@/server/audit";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { BookingError, cancelByAdmin, createTestLesson, resolveDispute } from "@/server/bookings";
import { isDateString, timeToMinutes, zonedDateTime } from "@/lib/dates";
import { db } from "@/server/db";
import { resetMaintenanceCache } from "@/server/maintenance";
import { recordManualPayout } from "@/server/ledger";
import { notify } from "@/server/notifications";
import { retryFailedRefund } from "@/server/payments/service";
import { setReviewStatus } from "@/server/reviews";
import { runScheduledTasks } from "@/server/scheduler";
import { parsePackages } from "@/server/credits";
import { parsePayoutDays } from "@/server/pricing";
import { saveSettings, settingsSchema, type SiteSettings } from "@/server/settings";
import { DocumentError, reviewTeacherDocument } from "@/server/teacher-documents";
import { CACHE_TAGS } from "@/server/site";
import { profileChecklist, TEACHERS_CACHE_TAG } from "@/server/teachers";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function admin() {
  return actionUser("ADMIN");
}

async function log(actorId: string, action: string, entityType: string, entityId: string | null, details?: Record<string, string | number | boolean | null>) {
  const { ipAddress } = await requestMeta();
  await audit({ actorId, action, entityType, entityId, details, ipAddress });
}

const DENIED = failure("Bu işlem için yönetici yetkisi gerekli.");

// ---------------------------------------------------------------------------
// Öğretmenler
// ---------------------------------------------------------------------------

const newTeacherSchema = z.object({
  firstName: z.string().trim().min(2, "Ad gerekli.").max(50),
  lastName: z.string().trim().min(2, "Soyad gerekli.").max(50),
  email: z.union([z.literal(""), z.email("Geçerli e-posta yazın.")]).optional(),
  phone: z.string().trim().optional(),
  username: z.string().trim().optional(),
  headline: z.string().trim().max(120).optional(),
});

export async function createTeacherAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const parsed = newTeacherSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failure("Lütfen alanları kontrol edin.", zodFieldErrors(parsed.error.issues));
  const input = parsed.data;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) return failure("Telefon 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz numara." });
  try {
    const result = await createTeacherAccount({ ...input, phone, email: input.email || null }, user.id);
    return success("Öğretmen hesabı oluşturuldu.", {
      teacherId: result.user.id,
      username: result.username,
      password: result.temporaryPassword,
      emailSent: Boolean(input.email),
    });
  } catch (error) {
    if (error instanceof AccountError) return failure(error.message);
    throw error;
  }
}

export async function updateTeacherAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const userId = text(formData, "userId");
  const email = text(formData, "email").toLowerCase() || null;
  const username = text(formData, "username").toLowerCase() || null;
  const phoneInput = text(formData, "phone");
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && !phone) return failure("Telefon 05XX XXX XX XX biçiminde olmalı.");
  if (email && !z.email().safeParse(email).success) return failure("Geçerli e-posta yazın.");
  if (username && !/^[a-z0-9._-]{3,40}$/.test(username)) return failure("Kullanıcı adı 3-40 karakter; harf, rakam, nokta, tire.");
  const clash = await db.user.findFirst({
    where: { id: { not: userId }, OR: [...(email ? [{ email }] : []), ...(username ? [{ username }] : [])] },
  });
  if (clash) return failure("Bu e-posta veya kullanıcı adı başka bir hesapta kullanılıyor.");
  await db.user.update({
    where: { id: userId },
    data: { firstName: text(formData, "firstName"), lastName: text(formData, "lastName"), email, username, phone },
  });
  await log(user.id, "user.update", "User", userId);
  updateTag(TEACHERS_CACHE_TAG);
  refresh();
  return success("Hesap bilgileri güncellendi.");
}

export async function setTeacherStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const teacherId = text(formData, "teacherId");
  const status = text(formData, "status");
  if (!["DRAFT", "PUBLISHED", "SUSPENDED"].includes(status)) return failure("Geçersiz durum.");
  const teacher = await db.teacherProfile.findUniqueOrThrow({ where: { userId: teacherId } });
  if (status === "PUBLISHED") {
    const checklist = await profileChecklist(teacherId);
    const required = checklist.items.filter((i) => ["offerings", "availability", "mode"].includes(i.key));
    if (required.some((i) => !i.done)) return failure("Yayına almak için en az bir ders/fiyat, müsaitlik takvimi ve ders şekli tanımlı olmalı.");
  }
  await db.teacherProfile.update({
    where: { userId: teacherId },
    data: { status: status as "DRAFT" | "PUBLISHED" | "SUSPENDED", publishedAt: status === "PUBLISHED" ? (teacher.publishedAt ?? new Date()) : teacher.publishedAt },
  });
  if (status === "PUBLISHED" && teacher.status !== "PUBLISHED") {
    await notify({ userId: teacherId, type: "teacher.published", title: "Profiliniz yayında!", body: "Artık veliler sizi öğretmen listesinde görebilir ve randevu talep edebilir.", link: "/ogretmen-paneli" });
  }
  await log(user.id, "teacher.status", "TeacherProfile", teacherId, { status });
  updateTag(TEACHERS_CACHE_TAG);
  refresh();
  return success(status === "PUBLISHED" ? "Öğretmen yayına alındı." : status === "SUSPENDED" ? "Öğretmen askıya alındı (yeni randevu alamaz)." : "Öğretmen taslağa alındı.");
}

export async function setTeacherFlagsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const teacherId = text(formData, "teacherId");
  const verification = text(formData, "verificationStatus");
  const commissionInput = text(formData, "commissionPercent").replace(",", ".");
  let commissionRateBps: number | null = null;
  if (commissionInput) {
    const percent = Number(commissionInput);
    if (!Number.isFinite(percent) || percent < 0 || percent > 90) return failure("Komisyon %0 ile %90 arasında olmalı.");
    commissionRateBps = Math.round(percent * 100);
  }
  if (!["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"].includes(verification)) return failure("Geçersiz doğrulama durumu.");
  await db.teacherProfile.update({
    where: { userId: teacherId },
    data: {
      verificationStatus: verification as "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED",
      isFeatured: formData.get("isFeatured") === "on",
      commissionRateBps,
    },
  });
  await log(user.id, "teacher.flags", "TeacherProfile", teacherId, { verification, featured: formData.get("isFeatured") === "on", commissionRateBps });
  refresh();
  return success("Öğretmen ayarları kaydedildi.");
}

export async function resetPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const userId = text(formData, "userId");
  const password = await resetTeacherPassword(userId, user.id);
  return success("Yeni geçici şifre oluşturuldu. Kullanıcı ilk girişte şifresini değiştirecek.", { password });
}

export async function setUserStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const userId = text(formData, "userId");
  const status = text(formData, "status") === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  if (userId === user.id) return failure("Kendi hesabınızı askıya alamazsınız.");
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
  await log(user.id, "user.status", "User", userId, { status });
  refresh();
  return success(status === "SUSPENDED" ? "Hesap askıya alındı; açık oturumları kapatıldı." : "Hesap yeniden etkinleştirildi.");
}

/** Öğretmen belgesini onaylar veya gerekçeyle reddeder; öğretmene bildirim gider. */
export async function reviewDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const decision = text(formData, "decision") === "APPROVED" ? "APPROVED" : "REJECTED";
  try {
    await reviewTeacherDocument(text(formData, "documentId"), user.id, decision, text(formData, "note"), formData.get("barcodeChecked") === "on");
  } catch (error) {
    if (error instanceof DocumentError) return failure(error.message);
    throw error;
  }
  refresh();
  return success(decision === "APPROVED" ? "Belge onaylandı." : "Belge reddedildi; öğretmene gerekçe iletildi.");
}

// ---------------------------------------------------------------------------
// Randevular ve para
// ---------------------------------------------------------------------------

export async function adminCancelBookingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const reason = text(formData, "reason");
  if (reason.length < 3) return failure("İptal gerekçesini yazın.");
  const refund = parseMoneyInput(text(formData, "refundAmount") || "0");
  if (refund === null) return failure("İade tutarını doğru yazın (örn. 450 veya 450,50).");
  const bookingId = text(formData, "bookingId");
  try {
    await cancelByAdmin(bookingId, user.id, refund, reason);
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  await log(user.id, "booking.admin_cancel", "Booking", bookingId, { refund, reason });
  redirect(`/yonetim/randevular/${bookingId}?durum=yonetici-iptal`);
}

export async function resolveDisputeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const note = text(formData, "note");
  if (note.length < 3) return failure("Sonuç notunu yazın (öğrenci ve öğretmene iletilir).");
  const refund = parseMoneyInput(text(formData, "refundAmount") || "0");
  if (refund === null) return failure("İade tutarını doğru yazın.");
  const bookingId = text(formData, "bookingId");
  try {
    await resolveDispute(bookingId, user.id, refund, note);
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  await log(user.id, "booking.dispute_resolve", "Booking", bookingId, { refund, note });
  redirect(`/yonetim/randevular/${bookingId}?durum=itiraz`);
}

/** Görüntülü görüşme denemesi için ödemesiz test dersi. */
export async function createTestLessonAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const student = await db.user.findUnique({ where: { email: text(formData, "studentEmail").toLowerCase() } });
  if (!student) return failure("Bu e-postayla kayıtlı öğrenci/veli bulunamadı.", { studentEmail: "Bulunamadı." });
  const startInput = text(formData, "startAt");
  let startAt = new Date(Math.ceil((Date.now() + 2 * 60_000) / 60_000) * 60_000);
  if (startInput) {
    const [date, time = ""] = startInput.split("T");
    const minutes = timeToMinutes(time);
    if (!isDateString(date) || minutes === null) return failure("Başlangıç zamanı geçersiz.");
    startAt = zonedDateTime(date, minutes);
  }
  let bookingId: string;
  try {
    const booking = await createTestLesson({
      teacherId: text(formData, "teacherId"),
      studentId: student.id,
      startAt,
      durationMinutes: Number(formData.get("duration") ?? 60),
      adminId: user.id,
    });
    bookingId = booking.id;
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  await log(user.id, "booking.test_create", "Booking", bookingId);
  redirect(`/yonetim/randevular/${bookingId}?durum=test`);
}

export async function retryRefundAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const ok = await retryFailedRefund(text(formData, "refundId"));
  await log(user.id, "refund.retry", "Refund", text(formData, "refundId"), { ok });
  refresh();
  return ok ? success("İade başarıyla gerçekleştirildi.") : failure("İade yine başarısız oldu; ayrıntı için ödeme kuruluşu panelini kontrol edin.");
}

export async function recordPayoutAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const amount = parseMoneyInput(text(formData, "amount"));
  const reference = text(formData, "reference");
  if (!amount) return failure("Ödeme tutarını yazın.");
  if (reference.length < 3) return failure("Havale açıklaması / dekont numarası yazın.");
  try {
    await recordManualPayout({ teacherId: text(formData, "teacherId"), amount, reference, adminId: user.id });
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Ödeme kaydedilemedi.");
  }
  await log(user.id, "payout.manual", "TeacherProfile", text(formData, "teacherId"), { amount, reference });
  await notify({ userId: text(formData, "teacherId"), type: "payout.sent", title: "Hakediş ödemeniz gönderildi", body: `Hesabınıza havale yapıldı. Açıklama: ${reference}`, link: "/ogretmen-paneli/kazanclar" });
  refresh();
  return success("Ödeme kaydedildi ve öğretmene bildirildi.");
}

export async function setReviewStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const status = text(formData, "status") === "HIDDEN" ? "HIDDEN" : "PUBLISHED";
  await setReviewStatus(text(formData, "reviewId"), status, text(formData, "reason") || null);
  await log(user.id, "review.status", "Review", text(formData, "reviewId"), { status });
  refresh();
  return success(status === "HIDDEN" ? "Yorum gizlendi." : "Yorum yeniden yayınlandı.");
}

export async function runSchedulerAction(): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const summary = await runScheduledTasks();
  refresh();
  if (!summary) return failure("Görevler şu anda başka bir süreçte çalışıyor; biraz sonra tekrar deneyin.");
  return success(`Görevler çalıştı: ${Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(", ")}`);
}

// ---------------------------------------------------------------------------
// Katalog
// ---------------------------------------------------------------------------

export async function saveLevelAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const id = Number(formData.get("id")) || null;
  const name = text(formData, "name");
  if (name.length < 2) return failure("Kademe adı gerekli.");
  const slug = slugify(text(formData, "slug") || name);
  const group = (["SCHOOL", "EXAM", "OTHER"].includes(text(formData, "group")) ? text(formData, "group") : "SCHOOL") as "SCHOOL" | "EXAM" | "OTHER";
  const data = { name, slug, group, sortOrder: Number(formData.get("sortOrder")) || 0, isActive: formData.get("isActive") === "on" };
  const clash = await db.level.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return failure("Bu adres (slug) başka bir kademede kullanılıyor.");
  const level = id ? await db.level.update({ where: { id }, data }) : await db.level.create({ data });

  const subjectIds = formData.getAll("subjectIds").map(Number).filter(Boolean);
  await db.$transaction([
    db.levelSubject.deleteMany({ where: { levelId: level.id, subjectId: { notIn: subjectIds } } }),
    db.levelSubject.createMany({ data: subjectIds.map((subjectId) => ({ levelId: level.id, subjectId })), skipDuplicates: true }),
  ]);
  const grades = text(formData, "grades").split(",").map((g) => g.trim()).filter(Boolean);
  await db.grade.deleteMany({ where: { levelId: level.id, name: { notIn: grades } } });
  for (const [index, gradeName] of grades.entries()) {
    await db.grade.upsert({ where: { levelId_name: { levelId: level.id, name: gradeName } }, create: { levelId: level.id, name: gradeName, sortOrder: index }, update: { sortOrder: index } });
  }
  await log(user.id, id ? "catalog.level_update" : "catalog.level_create", "Level", String(level.id));
  updateTag(CACHE_TAGS.catalog);
  refresh();
  return success("Kademe kaydedildi.");
}

export async function saveSubjectAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const id = Number(formData.get("id")) || null;
  const name = text(formData, "name");
  if (name.length < 2) return failure("Ders adı gerekli.");
  const slug = slugify(text(formData, "slug") || name);
  const clash = await db.subject.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return failure("Bu adres (slug) başka bir derste kullanılıyor.");
  const data = { name, slug, sortOrder: Number(formData.get("sortOrder")) || 0, isActive: formData.get("isActive") === "on" };
  const subject = id ? await db.subject.update({ where: { id }, data }) : await db.subject.create({ data });
  await log(user.id, id ? "catalog.subject_update" : "catalog.subject_create", "Subject", String(subject.id));
  updateTag(CACHE_TAGS.catalog);
  refresh();
  return success("Ders kaydedildi.");
}

export async function saveServiceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const id = Number(formData.get("id")) || null;
  const name = text(formData, "name");
  if (name.length < 2) return failure("Hizmet adı gerekli.");
  const slug = slugify(text(formData, "slug") || name);
  const clash = await db.serviceType.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return failure("Bu adres (slug) başka bir hizmette kullanılıyor.");
  const data = { name, slug, description: text(formData, "description") || null, sortOrder: Number(formData.get("sortOrder")) || 0, isActive: formData.get("isActive") === "on" };
  const service = id ? await db.serviceType.update({ where: { id }, data }) : await db.serviceType.create({ data });
  await log(user.id, id ? "catalog.service_update" : "catalog.service_create", "ServiceType", String(service.id));
  updateTag(CACHE_TAGS.catalog);
  refresh();
  return success("Hizmet kaydedildi.");
}

// ---------------------------------------------------------------------------
// İçerik ve ayarlar
// ---------------------------------------------------------------------------

export async function savePageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const id = text(formData, "id");
  const title = text(formData, "title");
  const content = String(formData.get("content") ?? "").trim();
  if (title.length < 2 || content.length < 2) return failure("Başlık ve içerik gerekli.");
  const slug = slugify(text(formData, "slug") || title);
  const clash = await db.page.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) return failure("Bu adres başka bir sayfada kullanılıyor.");
  const data = {
    title,
    slug,
    content,
    showInFooter: formData.get("showInFooter") === "on",
    isPublished: formData.get("isPublished") === "on",
    sortOrder: Number(formData.get("sortOrder")) || 0,
  };
  const page = id ? await db.page.update({ where: { id }, data }) : await db.page.create({ data });
  await log(user.id, id ? "page.update" : "page.create", "Page", page.id);
  updateTag(CACHE_TAGS.pages);
  refresh();
  return success("Sayfa kaydedildi.", { id: page.id });
}

export async function saveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const shape = settingsSchema.shape;
  const values: Record<string, unknown> = {};
  for (const key of Object.keys(shape) as (keyof SiteSettings)[]) {
    const defaultValue = settingsSchema.parse({})[key];
    // İşaretsiz onay kutusu forma hiç gelmez; formdaki tüm onay kutuları bu yüzden her zaman okunur.
    if (!formData.has(key) && typeof defaultValue !== "boolean") continue;
    if (typeof defaultValue === "boolean") values[key] = formData.get(key) === "on";
    else if (typeof defaultValue === "number") values[key] = key === "commissionRateBps" ? Math.round(Number(String(formData.get(key)).replace(",", ".")) * 100) : Number(formData.get(key));
    else values[key] = String(formData.get(key) ?? "").trim();
  }
  const parsed = settingsSchema.partial().safeParse(values);
  if (!parsed.success) {
    return failure("Bazı değerler geçersiz.", Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  }
  if (parsed.data.payoutDays !== undefined) {
    const days = parsePayoutDays(parsed.data.payoutDays);
    if (!days.length) return failure("Bazı değerler geçersiz.", { payoutDays: "1 ile 28 arasında en az bir gün yazın; örnek: 1,15" });
    parsed.data.payoutDays = days.join(",");
  }
  if (parsed.data.questionPackages !== undefined) {
    const packages = parsePackages(parsed.data.questionPackages);
    if (!packages.length) return failure("Bazı değerler geçersiz.", { questionPackages: "En az bir paket yazın; örnek: 1:25,10:200" });
    parsed.data.questionPackages = packages.map((p) => `${p.credits}:${p.price / 100}`).join(",");
  }
  await saveSettings(parsed.data);
  resetMaintenanceCache();
  await log(user.id, "settings.update", "SiteSetting", null, { keys: Object.keys(parsed.data).join(",") });
  updateTag(CACHE_TAGS.settings);
  refresh();
  return success("Ayarlar kaydedildi.");
}

/** Hata takibi: hatayı (ya da tümünü) çözüldü işaretler; tekrar oluşursa yeniden bildirilir. */
export async function resolveErrorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await admin();
  if (!user) return DENIED;
  const id = text(formData, "id");
  const result = await db.errorEvent.updateMany({ where: { resolvedAt: null, ...(id ? { id } : {}) }, data: { resolvedAt: new Date() } });
  refresh();
  return success(result.count ? "Çözüldü olarak işaretlendi." : "Açık hata yok.");
}

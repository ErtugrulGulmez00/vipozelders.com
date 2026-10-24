"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { normalizePhone } from "@/lib/text";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import {
  BookingError,
  cancelByStudent,
  completeCheckout,
  createBookingHold,
  openDispute,
  startCheckout,
} from "@/server/bookings";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/payments/service";
import { paymentSubject } from "@/server/payments/subject";
import { ReviewError, upsertReview } from "@/server/reviews";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

const bookingSchema = z.object({
  offeringId: z.string().min(1),
  startAt: z.iso.datetime({ error: "Geçersiz saat." }),
  duration: z.coerce.number().int(),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  learnerName: z.string().trim().min(2, "Dersin kimin için olduğunu yazın.").max(60),
  learnerGrade: z.string().trim().max(40).optional(),
  place: z.enum(["STUDENT_HOME", "TEACHER_PLACE"]).optional(),
  districtId: z.coerce.number().int().optional(),
  address: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
  // Ücretsiz tanışma görüşmesinde satış olmadığı için sözleşme onayı istenmez
  intro: z.literal("1").optional(),
  consent: z.literal("on").optional(),
});

/** Rezervasyon formu: saati ayırır ve ödeme sayfasına yönlendirir. */
export async function createBookingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Randevu almak için veli/öğrenci hesabıyla giriş yapın.");

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = bookingSchema.safeParse(raw);
  if (!parsed.success) return failure("Lütfen işaretli alanları kontrol edin.", zodFieldErrors(parsed.error.issues));
  const input = parsed.data;
  const intro = input.intro === "1";
  if (!intro && input.consent !== "on") return failure("Lütfen işaretli alanları kontrol edin.", { consent: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." });

  let redirectUrl: string;
  try {
    const booking = await createBookingHold({
      studentId: user.id,
      offeringId: input.offeringId,
      startAt: new Date(input.startAt),
      durationMinutes: input.duration,
      mode: input.mode,
      learnerName: input.learnerName,
      learnerGrade: input.learnerGrade,
      inPersonPlace: input.mode === "IN_PERSON" ? (input.place ?? null) : null,
      districtId: input.districtId ?? null,
      address: input.address ?? null,
      studentNote: input.note ?? null,
      intro,
    });
    if (intro) {
      redirectUrl = `/hesabim/derslerim/${booking.id}?durum=tanisma`;
    } else {
      const { ipAddress } = await requestMeta();
      redirectUrl = await startCheckout(booking.id, user.id, ipAddress ?? "127.0.0.1");
    }
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

/** Ödeme başarısız olduysa (saat hâlâ ayrılmışken) tekrar dene. */
export async function retryPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  let redirectUrl: string;
  try {
    const { ipAddress } = await requestMeta();
    redirectUrl = await startCheckout(text(formData, "bookingId"), user.id, ipAddress ?? "127.0.0.1");
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

/** Geliştirme ortamındaki test ödeme sayfasının sonucu. */
export async function mockPaymentAction(formData: FormData) {
  const user = await actionUser("STUDENT");
  // Sahte ödeme yalnızca test sağlayıcısı etkinken çalışır.
  if (!user || getPaymentProvider().id !== "mock") redirect("/");
  const paymentId = text(formData, "paymentId");
  const outcome = text(formData, "outcome") === "success" ? "success" : "failure";
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: true, creditPurchase: true, subscription: true, groupEnrollment: { include: { course: true } } } });
  const subject = payment ? paymentSubject(payment) : null;
  if (!payment || !subject || subject.ownerId !== user.id || payment.provider !== "mock" || !payment.providerToken) redirect("/hesabim");
  if (payment.status === "INITIATED") {
    await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: outcome } } });
    await completeCheckout(payment.providerToken);
  }
  redirect(`/odeme/sonuc/${subject.resultId}`);
}

export async function cancelBookingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = text(formData, "reason");
  if (reason.length < 3) return failure("Lütfen kısa bir iptal gerekçesi yazın.", { reason: "Gerekçe yazın." });
  const bookingId = text(formData, "bookingId");
  try {
    await cancelByStudent(bookingId, user.id, reason.slice(0, 300));
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/derslerim/${bookingId}?durum=iptal`);
}

export async function disputeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = text(formData, "reason");
  if (reason.length < 10) return failure("Yaşadığınız sorunu biraz daha ayrıntılı anlatın.", { reason: "En az 10 karakter." });
  const bookingId = text(formData, "bookingId");
  try {
    await openDispute(bookingId, user.id, reason.slice(0, 1000));
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/derslerim/${bookingId}?durum=bildirildi`);
}

export async function reviewAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  const rating = Number(formData.get("rating"));
  try {
    await upsertReview(user.id, text(formData, "teacherId"), rating, text(formData, "comment"));
  } catch (error) {
    if (error instanceof ReviewError) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Değerlendirmeniz için teşekkürler!");
}

export async function toggleFavoriteAction(formData: FormData) {
  const user = await actionUser("STUDENT");
  const teacherId = text(formData, "teacherId");
  if (!user) redirect(`/giris?next=${encodeURIComponent(text(formData, "returnTo") || "/ogretmenler")}`);
  const key = { studentId_teacherId: { studentId: user.id, teacherId } };
  const existing = await db.favorite.findUnique({ where: key });
  if (existing) await db.favorite.delete({ where: key });
  else if (await db.teacherProfile.findUnique({ where: { userId: teacherId }, select: { userId: true } })) {
    await db.favorite.create({ data: { studentId: user.id, teacherId } });
  }
  refresh();
}

const profileSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  lastName: z.string().trim().min(2).max(50),
  phone: z.string().trim().optional(),
  accountType: z.enum(["PARENT", "STUDENT"]),
  cityId: z.coerce.number().int().optional(),
  marketing: z.string().optional(),
});

export async function updateStudentProfileAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  const parsed = profileSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return failure("Lütfen alanları kontrol edin.", zodFieldErrors(parsed.error.issues));
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return failure("Telefon numarası 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz numara." });

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone,
      studentProfile: {
        update: { accountType: parsed.data.accountType, cityId: parsed.data.cityId ?? null, marketingConsent: parsed.data.marketing === "on" },
      },
    },
  });
  refresh();
  return success("Bilgileriniz güncellendi.");
}

export async function addLearnerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  const name = text(formData, "name");
  if (name.length < 2) return failure("İsim yazın.");
  await db.learner.upsert({
    where: { studentId_name: { studentId: user.id, name } },
    create: { studentId: user.id, name, gradeName: text(formData, "gradeName") || null },
    update: { gradeName: text(formData, "gradeName") || null },
  });
  refresh();
  return success("Kaydedildi.");
}

export async function removeLearnerAction(formData: FormData) {
  const user = await actionUser("STUDENT");
  if (!user) return;
  await db.learner.deleteMany({ where: { id: text(formData, "learnerId"), studentId: user.id } });
  refresh();
}

export async function markNotificationsReadAction() {
  const user = await actionUser();
  if (!user) return;
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refresh();
}

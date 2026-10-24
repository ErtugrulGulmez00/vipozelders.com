"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { approveBooking, BookingError } from "@/server/bookings";
import { createLessonPackage, PackageError, refundPackage, saveTeacherPackageDiscounts, startPackageCheckout } from "@/server/packages";
import { cancelRescheduleRequest, requestReschedule, respondReschedule } from "@/server/reschedule";
import { db } from "@/server/db";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function run(work: () => Promise<string | void>, ok: string): Promise<ActionState> {
  try {
    const message = await work();
    refresh();
    return success(message || ok);
  } catch (error) {
    if (error instanceof PackageError || error instanceof BookingError) return failure(error.message);
    throw error;
  }
}

export async function buyPackageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Paket almak için veli/öğrenci hesabıyla giriş yapın.");
  if (formData.get("consent") !== "on") return failure("Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.", { consent: "Onay gerekli." });
  const repeatAt = text(formData, "tekrar");
  const recurring = repeatAt
    ? { startAt: new Date(repeatAt), weeks: Number(text(formData, "hafta")), learnerName: text(formData, "learnerName"), learnerGrade: text(formData, "learnerGrade") || null, note: text(formData, "note") || null }
    : null;
  if (recurring && !recurring.learnerName) return failure("Dersin kimin için olduğunu yazın.", { learnerName: "Ad gerekli." });
  let redirectUrl: string;
  try {
    const pkg = await createLessonPackage(user.id, { offeringId: text(formData, "offeringId"), durationMinutes: Number(text(formData, "duration")), lessons: Number(text(formData, "lessons")), recurring });
    const { ipAddress } = await requestMeta();
    redirectUrl = await startPackageCheckout(pkg.id, user.id, ipAddress ?? "127.0.0.1");
  } catch (error) {
    if (error instanceof PackageError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

export async function refundPackageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(async () => `${formatMoney(await refundPackage(text(formData, "id"), user.id))} kartınıza iade ediliyor.`, "İade başlatıldı.");
}

export async function savePackageDiscountsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const lessons = formData.getAll("lessons").map((v) => Number(v));
  const percents = formData.getAll("percent").map((v) => Number(v));
  const rows = lessons.map((l, i) => ({ lessons: l, percent: percents[i] ?? 0 })).filter((r) => r.lessons > 0);
  return run(async () => {
    const saved = await saveTeacherPackageDiscounts(user.id, rows);
    return saved.length ? `Paketler kaydedildi: ${saved.map((r) => `${r.lessons} ders %${r.percent}`).join(", ")}.` : "Paket satışı kapatıldı.";
  }, "Kaydedildi.");
}

/** Öğretmen: tekrarlayan dersin (paketin) bekleyen tüm taleplerini onaylar. */
export async function approvePackageBookingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const pending = await db.booking.findMany({ where: { packageId: text(formData, "packageId"), teacherId: user.id, status: "PENDING_APPROVAL" }, select: { id: true } });
  let approved = 0;
  for (const b of pending) {
    try {
      await approveBooking(b.id, user.id);
      approved++;
    } catch (error) {
      if (!(error instanceof BookingError)) throw error;
    }
  }
  refresh();
  return success(`${approved} ders onaylandı.`);
}

// Erteleme

export async function requestRescheduleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT", "TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const start = text(formData, "newStartAt");
  if (!start) return failure("Yeni saat seçin.");
  return run(async () => {
    await requestReschedule(text(formData, "bookingId"), user.id, new Date(start), text(formData, "note") || null);
  }, "Öneriniz karşı tarafa iletildi; kabul edilirse ders yeni saate taşınır.");
}

export async function respondRescheduleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT", "TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const accept = formData.get("decision") === "accept";
  return run(() => respondReschedule(text(formData, "requestId"), user.id, accept), accept ? "Ders yeni saate taşındı." : "Öneri reddedildi; ders eski saatinde.");
}

export async function cancelRescheduleAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT", "TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => cancelRescheduleRequest(text(formData, "requestId"), user.id), "Öneri geri çekildi.");
}

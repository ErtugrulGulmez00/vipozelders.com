"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { BookingError, startCheckout } from "@/server/bookings";
import { addQuestionMessage, createQuestionHold } from "@/server/question-bookings";

const file = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

const questionSchema = z.object({
  offeringId: z.string().min(1),
  learnerName: z.string().trim().min(2, "Sorunun kimin için olduğunu yazın.").max(60),
  learnerGrade: z.string().trim().max(40).optional(),
  note: z.string().trim().max(1000).optional(),
  consent: z.literal("on", { error: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." }),
});

/** Fotoğrafla soru: soruyu kaydeder ve ödeme sayfasına yönlendirir. */
export async function createQuestionBookingAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Soru göndermek için veli/öğrenci hesabıyla giriş yapın.");
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v !== ""));
  const parsed = questionSchema.safeParse(raw);
  if (!parsed.success) return failure("Lütfen işaretli alanları kontrol edin.", zodFieldErrors(parsed.error.issues));
  const image = file(formData, "image");
  if (!image) return failure("Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });

  let redirectUrl: string;
  try {
    const booking = await createQuestionHold({ studentId: user.id, offeringId: parsed.data.offeringId, learnerName: parsed.data.learnerName, learnerGrade: parsed.data.learnerGrade, note: parsed.data.note, image });
    const { ipAddress } = await requestMeta();
    redirectUrl = await startCheckout(booking.id, user.id, ipAddress ?? "127.0.0.1");
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

/** Soru yazışmasına mesaj ya da (öğretmen) çözüm ekler. */
export async function addQuestionMessageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser();
  if (!user || (user.role !== "STUDENT" && user.role !== "TEACHER")) return failure("Oturumunuz kapanmış.");
  try {
    const result = await addQuestionMessage(String(formData.get("bookingId") ?? ""), user, {
      body: String(formData.get("body") ?? ""),
      image: file(formData, "image"),
      video: file(formData, "video"),
      isSolution: formData.get("isSolution") === "on",
    });
    refresh();
    return success(result.solved ? "Çözüm gönderildi; öğrenciye bildirim gitti." : "Mesaj gönderildi.");
  } catch (error) {
    if (error instanceof BookingError) return failure(error.message);
    throw error;
  }
}

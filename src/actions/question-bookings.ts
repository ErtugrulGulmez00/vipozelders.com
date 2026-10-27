"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { BookingError } from "@/server/bookings";
import { addQuestionMessage } from "@/server/question-bookings";

const file = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

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

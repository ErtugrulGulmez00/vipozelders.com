"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { MessageError, messageTeacher, sendMessage } from "@/server/messages";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Öğretmen profilinden mesaj: konuşma açılır ve öğrenci konuşma sayfasına gider. */
export async function messageTeacherAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Mesaj göndermek için veli/öğrenci hesabıyla giriş yapın.");
  let threadId: string;
  try {
    threadId = (await messageTeacher(user.id, text(formData, "teacherId"), text(formData, "body"))).id;
  } catch (error) {
    if (error instanceof MessageError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/mesajlar/${threadId}`);
}

export async function sendMessageAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT", "TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    const { masked } = await sendMessage(text(formData, "threadId"), user, text(formData, "body"));
    refresh();
    return success(masked ? "Gönderildi. Telefon, e-posta ve adres gibi iletişim bilgileri güvenliğiniz için gizlendi." : undefined);
  } catch (error) {
    if (error instanceof MessageError) return failure(error.message);
    throw error;
  }
}

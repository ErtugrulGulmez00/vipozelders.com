"use server";

import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { refresh } from "next/cache";
import { actionUser, getCurrentUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { db } from "@/server/db";
import { LessonRequestError, lessonRequestSchema, submitLessonRequest } from "@/server/lesson-requests";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Herkese açık öğretmen talebi formu. */
export async function submitLessonRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  // Botlar gizli alanı doldurur; insanlar görmez.
  if (text(formData, "website")) return success("Talebiniz alındı.");
  if (formData.get("kvkk") !== "on") return failure("Size dönebilmemiz için aydınlatma metnini onaylayın.", { kvkk: "Onay gerekli." });
  const raw = Object.fromEntries([...formData.entries()].filter(([key, value]) => value !== "" && !["kvkk", "website"].includes(key)));
  const parsed = lessonRequestSchema.safeParse(raw);
  if (!parsed.success) return failure("Lütfen işaretli alanları düzeltin.", zodFieldErrors(parsed.error.issues));
  try {
    const user = await getCurrentUser();
    const { ipAddress } = await requestMeta();
    await submitLessonRequest(parsed.data, user?.role === "STUDENT" ? user.id : null, ipAddress);
  } catch (error) {
    if (error instanceof LessonRequestError) return failure(error.message, error.fieldErrors);
    throw error;
  }
  return success("Talebiniz alındı! Uygun öğretmeni bulduğumuzda sizi arayacağız ya da size yazacağız. Bu arada ilgili öğretmenlere haber verdik.");
}

export async function updateLessonRequestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  const status = text(formData, "status");
  if (!["NEW", "CONTACTED", "MATCHED", "CLOSED"].includes(status)) return failure("Durum seçin.");
  await db.lessonRequest.update({ where: { id: text(formData, "id") }, data: { status: status as "NEW", adminNote: text(formData, "adminNote").slice(0, 1000) || null } });
  refresh();
  return success("Talep güncellendi.");
}

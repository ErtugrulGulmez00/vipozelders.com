"use server";

import { refresh } from "next/cache";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { maintenanceState } from "@/server/maintenance";
import { ApplicationError, applicationSchema, approveApplication, rejectApplication, submitTeacherApplication } from "@/server/teacher-applications";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Herkese açık öğretmen başvuru formu. */
export async function applyTeacherAction(_: ActionState, formData: FormData): Promise<ActionState> {
  // Botlar gizli alanı doldurur; insanlar görmez.
  if (text(formData, "website")) return success("Başvurunuz alındı.");
  if ((await maintenanceState()).on) return failure("Site şu an bakımda; lütfen biraz sonra tekrar deneyin.");
  if (formData.get("rules") !== "on") return failure("Devam etmek için platform kurallarını kabul edin.", { rules: "Onay gerekli." });
  if (formData.get("kvkk") !== "on") return failure("Devam etmek için aydınlatma metnini onaylayın.", { kvkk: "Onay gerekli." });

  const raw = Object.fromEntries([...formData.entries()].filter(([key, value]) => value !== "" && !["kvkk", "rules", "website", "offersOnline", "offersInPerson"].includes(key)));
  const parsed = applicationSchema.safeParse({ ...raw, offersOnline: formData.get("offersOnline") === "on", offersInPerson: formData.get("offersInPerson") === "on" });
  if (!parsed.success) return failure("Lütfen işaretli alanları düzeltin.", zodFieldErrors(parsed.error.issues));

  try {
    const { ipAddress } = await requestMeta();
    await submitTeacherApplication(parsed.data, ipAddress);
  } catch (error) {
    if (error instanceof ApplicationError) return failure(error.message, error.fieldErrors);
    throw error;
  }
  return success("Başvurunuz alındı! Ekibimiz bilgilerinizi inceleyip birkaç gün içinde size dönüş yapacak. Onay e-postası gelen kutunuzda.");
}

export async function approveApplicationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  try {
    const result = await approveApplication(text(formData, "applicationId"), user.id);
    // Sayfa yenilenmez: giriş bilgileri yönetici kopyalayana kadar ekranda kalır.
    return success("Öğretmen hesabı açıldı.", { teacherId: result.user.id, username: result.username, password: result.temporaryPassword, emailSent: true });
  } catch (error) {
    if (error instanceof ApplicationError) return failure(error.message);
    throw error;
  }
}

export async function rejectApplicationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  try {
    await rejectApplication(text(formData, "applicationId"), user.id, text(formData, "note"));
  } catch (error) {
    if (error instanceof ApplicationError) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Başvuru reddedildi; adaya bilgilendirme e-postası gönderildi.");
}

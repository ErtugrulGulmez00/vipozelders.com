"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { centerApplicationSchema, leadSchema, submitCenterApplication, submitLead } from "@/server/center/admin";
import { CenterError } from "@/server/center/errors";
import { acceptInvite, unlinkGuardian } from "@/server/center/portal";
import { askQuestion, withdrawQuestion } from "@/server/center/questions";
import { maintenanceState } from "@/server/maintenance";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** "Kurumlar için" sayfasındaki demo / abonelik başvurusu. */
export async function applyCenterAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (text(formData, "website")) return success("Başvurunuz alındı.");
  if ((await maintenanceState()).on) return failure("Site şu an bakımda; lütfen biraz sonra tekrar deneyin.");
  if (formData.get("kvkk") !== "on") return failure("Devam etmek için aydınlatma metnini onaylayın.", { kvkk: "Onay gerekli." });
  const raw = Object.fromEntries([...formData.entries()].filter(([key, value]) => value !== "" && !["kvkk", "website"].includes(key)));
  const parsed = centerApplicationSchema.safeParse(raw);
  if (!parsed.success) return failure("Lütfen işaretli alanları düzeltin.", zodFieldErrors(parsed.error.issues));
  try {
    const { ipAddress } = await requestMeta();
    await submitCenterApplication(parsed.data, ipAddress);
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message, error.fieldErrors);
    throw error;
  }
  return success("Başvurunuz alındı! Ekibimiz en kısa sürede sizi arayıp paneli birlikte kuracak. Onay e-postası gelen kutunuzda.");
}

/** Kurum vitrin sayfasındaki ön kayıt formu. */
export async function submitLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  if (text(formData, "website")) return success("Talebiniz alındı.");
  if (formData.get("kvkk") !== "on") return failure("Devam etmek için aydınlatma metnini onaylayın.", { kvkk: "Onay gerekli." });
  const raw = Object.fromEntries([...formData.entries()].filter(([key, value]) => value !== "" && !["kvkk", "website", "slug"].includes(key)));
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) return failure("Lütfen işaretli alanları düzeltin.", zodFieldErrors(parsed.error.issues));
  try {
    const { ipAddress } = await requestMeta();
    const center = await submitLead(text(formData, "slug"), parsed.data, ipAddress);
    return success(`Talebiniz ${center.name} kurumuna iletildi. Kurum sizi en kısa sürede arayacak.`);
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message, error.fieldErrors);
    throw error;
  }
}

/** Veli, kurumun gönderdiği davetle hesabını öğrenciye bağlar. */
export async function acceptGuardianInviteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Daveti kabul etmek için veli hesabınızla giriş yapın.");
  let guardianId = "";
  try {
    const guardian = await acceptInvite(user.id, text(formData, "token"));
    guardianId = guardian.id;
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/kurum/${guardianId}?durum=baglandi`);
}

export async function unlinkGuardianAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  await unlinkGuardian(user.id, text(formData, "guardianId"));
  refresh();
  redirect("/hesabim/kurum?durum=ayrildi");
}

/** Öğrenci ya da velisi, kuruma fotoğrafla soru gönderir. */
export async function askQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Soru göndermek için giriş yapın.");
  const subject = text(formData, "subject").slice(0, 60);
  if (subject.length < 2) return failure("Dersi seçin.", { subject: "Ders gerekli." });
  const image = formData.get("image");
  try {
    await askQuestion(user.id, text(formData, "guardianId"), { subject, note: text(formData, "note").slice(0, 500) || null, image: image instanceof File ? image : null });
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message, error.fieldErrors);
    throw error;
  }
  refresh();
  return success("Sorun öğretmene iletildi. Çözüm eklenince bildirim alacaksın.");
}

export async function withdrawQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    await withdrawQuestion(user.id, text(formData, "questionId"));
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Soru geri çekildi.");
}

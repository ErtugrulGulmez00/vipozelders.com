"use server";

import { refresh } from "next/cache";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { CenterError } from "@/server/center/errors";
import { addInquiryToCoach, InquiryError, inquirySchema, respondInquiry, submitInquiry, type CoachLinkResult } from "@/server/teacher-inquiries";

function linkMessage(link: CoachLinkResult): string {
  if (!link.added) return link.reason;
  return link.createdCoach ? "Öğrenci, sizin için ücretsiz açtığımız Pi Koç hesabına eklendi." : "Öğrenci Pi Koç'unuza eklendi.";
}

/** Vitrinden öğretmene ders talebi (veli/öğrenci hesabıyla). */
export async function submitInquiryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Ders talebi göndermek için veli/öğrenci hesabıyla giriş yapın.");
  if (formData.get("consent") !== "on") return failure("Telefon numaranızın öğretmenle paylaşılmasını onaylayın.", { consent: "Onay gerekli." });
  const raw = Object.fromEntries([...formData.entries()].filter(([key, value]) => value !== "" && key !== "consent"));
  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) return failure("Lütfen işaretli alanları düzeltin.", zodFieldErrors(parsed.error.issues));
  try {
    const { ipAddress } = await requestMeta();
    await submitInquiry(parsed.data, { id: user.id, email: user.email }, ipAddress);
  } catch (error) {
    if (error instanceof InquiryError) return failure(error.message, error.fieldErrors);
    throw error;
  }
  refresh();
  return success("Talebiniz öğretmene iletildi. Öğretmen kabul edince size haber vereceğiz ve sizi arayacak.");
}

export async function respondInquiryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  const accept = formData.get("accept") === "1";
  const inquiryId = String(formData.get("inquiryId") ?? "");
  let link: CoachLinkResult | null = null;
  try {
    await respondInquiry(user.id, inquiryId, accept);
    // Kabul edilen talebin öğrencisi Pi Koç'a düşer; eklenemezse kabul geçerli kalır, öğretmen sonra tekrar dener
    if (accept) link = await addInquiryToCoach(user.id, inquiryId).catch((error) => (error instanceof CenterError || error instanceof InquiryError ? { added: false as const, createdCoach: false, reason: error.message } : Promise.reject(error)));
  } catch (error) {
    if (error instanceof InquiryError) return failure(error.message);
    throw error;
  }
  refresh();
  return success(accept ? `Talebi kabul ettiniz. ${link ? linkMessage(link) : ""} Velinin telefonu aşağıda; arayıp ders saatini ve ücreti konuşun.` : "Talep geri çevrildi; veliye nazikçe haber verdik.");
}

/** Kabul edilmiş ama sınır yüzünden Pi Koç'a eklenememiş talebi yeniden dener. */
export async function addInquiryToCoachAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  try {
    const link = await addInquiryToCoach(user.id, String(formData.get("inquiryId") ?? ""));
    if (!link.added) return failure(link.reason);
    refresh();
    return success(linkMessage(link));
  } catch (error) {
    if (error instanceof InquiryError || error instanceof CenterError) return failure(error.message);
    throw error;
  }
}

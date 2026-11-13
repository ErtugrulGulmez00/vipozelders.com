"use server";

import { refresh } from "next/cache";
import { failure, success, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { InquiryError, inquirySchema, respondInquiry, submitInquiry } from "@/server/teacher-inquiries";

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
  try {
    await respondInquiry(user.id, String(formData.get("inquiryId") ?? ""), accept);
  } catch (error) {
    if (error instanceof InquiryError) return failure(error.message);
    throw error;
  }
  refresh();
  return success(accept ? "Talebi kabul ettiniz. Velinin telefonu aşağıda; arayıp ders saatini ve ücreti konuşun." : "Talep geri çevrildi; veliye nazikçe haber verdik.");
}

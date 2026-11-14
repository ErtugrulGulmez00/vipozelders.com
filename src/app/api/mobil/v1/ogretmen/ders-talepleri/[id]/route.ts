import { z } from "zod";
import { CenterError } from "@/server/center/errors";
import { requireRole } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { addInquiryToCoach, InquiryError, respondInquiry, type CoachLinkResult } from "@/server/teacher-inquiries";

function linkMessage(link: CoachLinkResult): string {
  if (!link.added) return link.reason;
  return link.createdCoach ? "Öğrenci, sizin için ücretsiz açtığımız Pi Koç hesabına eklendi." : "Öğrenci Pi Koç'unuza eklendi.";
}

/**
 * Ders talebine yanıt: { action: "accept" | "decline" | "koc" }. Kabul edilen talebin öğrencisi Pi Koç'a eklenir
 * (koltuk kuralı geçerli; eklenemezse kabul geçerli kalır, "koc" ile yeniden denenir). → { message, added }
 */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "TEACHER");
  const { action } = await readBody(request, z.object({ action: z.enum(["accept", "decline", "koc"]) }));
  try {
    if (action === "koc") {
      const link = await addInquiryToCoach(user.id, params.id);
      if (!link.added) throw new ApiError(409, "COACH_FULL", link.reason);
      return json({ message: linkMessage(link), added: true });
    }
    await respondInquiry(user.id, params.id, action === "accept");
    if (action === "decline") return json({ message: "Talep geri çevrildi; veliye nazikçe haber verdik.", added: false });
    const link = await addInquiryToCoach(user.id, params.id).catch((error) =>
      error instanceof CenterError || error instanceof InquiryError ? ({ added: false as const, createdCoach: false, reason: error.message }) : Promise.reject(error),
    );
    return json({ message: `Talebi kabul ettiniz. ${linkMessage(link)} Velinin telefonu görünür; arayıp ders saatini ve ücreti konuşun.`, added: link.added });
  } catch (error) {
    if (error instanceof InquiryError || error instanceof CenterError) throw new ApiError(422, "VALIDATION", error.message);
    throw error;
  }
});

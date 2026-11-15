import { z } from "zod";
import { CenterError } from "@/server/center/errors";
import { requireRole } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { db } from "@/server/db";
import { blockUser, reportContent, SafetyError, unblockUser } from "@/server/safety";
import { addInquiryToCoach, InquiryError, respondInquiry, type CoachLinkResult } from "@/server/teacher-inquiries";

function linkMessage(link: CoachLinkResult): string {
  if (!link.added) return link.reason;
  return link.createdCoach ? "Öğrenci, sizin için ücretsiz açtığımız Pi Koç hesabına eklendi." : "Öğrenci Pi Koç'unuza eklendi.";
}

/**
 * Ders talebine yanıt: { action: "accept" | "decline" | "koc" | "report" | "block" | "unblock" } (report: reason, note). Kabul edilen talebin öğrencisi Pi Koç'a eklenir
 * (koltuk kuralı geçerli; eklenemezse kabul geçerli kalır, "koc" ile yeniden denenir). → { message, added }
 */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "TEACHER");
  const { action, reason, note } = await readBody(request, z.object({ action: z.enum(["accept", "decline", "koc", "report", "block", "unblock"]), reason: z.string().max(40).optional(), note: z.string().max(1000).optional() }));
  try {
    if (action === "report" || action === "block" || action === "unblock") {
      const inquiry = await db.teacherInquiry.findFirst({ where: { id: params.id, teacherId: user.id }, select: { requesterId: true } });
      if (!inquiry?.requesterId) throw new ApiError(404, "NOT_FOUND", "Talep bulunamadı.");
      if (action === "report") {
        const { duplicate } = await reportContent({ reporterId: user.id, targetUserId: inquiry.requesterId, kind: "inquiry", refId: params.id, reason: reason ?? "diger", note });
        return json({ message: duplicate ? "Bu bildirimi zaten aldık; ekibimiz inceliyor." : "Bildiriminiz alındı. Pi Kampüs ekibi inceleyecek.", added: false });
      }
      if (action === "block") await blockUser(user.id, inquiry.requesterId);
      else await unblockUser(user.id, inquiry.requesterId);
      return json({ message: action === "block" ? "Engellendi. Bu veli size artık mesaj ve ders talebi gönderemez." : "Engel kaldırıldı.", added: false });
    }
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
    if (error instanceof InquiryError || error instanceof CenterError || error instanceof SafetyError) throw new ApiError(422, "VALIDATION", error.message);
    throw error;
  }
});

import { requireRole } from "@/server/mobile/auth";
import { subscriptionStatusJson } from "@/server/mobile/commerce";
import { ApiError, json } from "@/server/mobile/http";
import { studentQuestionJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";
import { askSubscriptionQuestion } from "@/server/subscriptions";

/** Abonelik durumu (ödeme sonrası sorgulanır). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await subscriptionStatusJson(user.id, params.id));
});

/** Abone olunan öğretmene soru (kredi harcamaz, günlük sınır): multipart/form-data image, note? → 201 soru ayrıntısı. */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const form = await request.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_REQUEST", "multipart/form-data bekleniyor.");
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) throw new ApiError(422, "VALIDATION", "Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });
  const note = String(form.get("note") ?? "").trim();
  const question = await askSubscriptionQuestion(user.id, params.id, { note: note || null, image });
  return json(await studentQuestionJson(user.id, question.id), 201);
});

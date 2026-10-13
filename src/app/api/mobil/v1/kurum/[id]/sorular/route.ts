import { CenterError } from "@/server/center/errors";
import { askQuestion } from "@/server/center/questions";
import { requireRole } from "@/server/mobile/auth";
import { ApiError, json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Fotoğrafla soru gönderir (multipart/form-data: image, subject, note). */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const form = await request.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_REQUEST", "multipart/form-data bekleniyor.");
  const subject = String(form.get("subject") ?? "").trim().slice(0, 60);
  if (subject.length < 2) throw new ApiError(422, "VALIDATION", "Dersi seçin.", { subject: "Ders gerekli." });
  const image = form.get("image");
  try {
    const question = await askQuestion(user.id, params.id, { subject, note: String(form.get("note") ?? "").trim().slice(0, 500) || null, image: image instanceof File ? image : null });
    return json({ id: question.id }, 201);
  } catch (error) {
    if (error instanceof CenterError) throw new ApiError(422, "RULE_VIOLATION", error.message, error.fieldErrors);
    throw error;
  }
});

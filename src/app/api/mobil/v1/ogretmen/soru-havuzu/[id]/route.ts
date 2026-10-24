import { z } from "zod";
import { requireRole } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { teacherQuestionJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";
import { answerFollowUp, answerPoolQuestion, claimPoolQuestion, rejectPoolQuestion, releasePoolClaim } from "@/server/question-pool";

/** Havuzdaki (ya da öğretmenin üstlendiği) soru; öğrencinin adı gösterilmez. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "TEACHER");
  return json(await teacherQuestionJson(user.id, params.id));
});

const file = (form: FormData, key: string) => {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("reject"), reason: z.string().max(300) }),
  z.object({ action: z.literal("followUpAnswer"), body: z.string() }),
]);

/**
 * JSON: { action: "claim" | "release" } · { action: "reject", reason } (tek soru değil / okunmuyor: kredi iade)
 * · { action: "followUpAnswer", body }. Çözüm multipart/form-data ile: body (en az 20 karakter), image?, video?.
 */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "TEACHER");
  if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) throw new ApiError(400, "BAD_REQUEST", "multipart/form-data okunamadı.");
    await answerPoolQuestion(user.id, params.id, { text: String(form.get("body") ?? ""), image: file(form, "image"), video: file(form, "video") });
    return json(await teacherQuestionJson(user.id, params.id));
  }
  const input = await readBody(request, actionSchema);
  if (input.action === "claim") await claimPoolQuestion(user.id, params.id);
  if (input.action === "release") await releasePoolClaim(user.id, params.id);
  if (input.action === "reject") await rejectPoolQuestion(user.id, params.id, input.reason);
  if (input.action === "followUpAnswer") await answerFollowUp(user.id, params.id, input.body);
  // Bırakılan soru başkasına geçebilir; ayrıntı alınamazsa yalnızca sonuç döner.
  if (input.action === "release") return json({ ok: true });
  return json(await teacherQuestionJson(user.id, params.id));
});

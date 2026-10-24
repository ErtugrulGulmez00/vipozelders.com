import { requireRole } from "@/server/mobile/auth";
import { ApiError, json, pageParam } from "@/server/mobile/http";
import { studentQuestionJson, studentQuestionsJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";
import { askPoolQuestion } from "@/server/question-pool";

/** Öğrencinin soru havuzuna gönderdiği sorular (?sayfa=). */
export const GET = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  return json(await studentQuestionsJson(user.id, pageParam(new URL(request.url))));
});

/** Soru gönderir (1 kredi): multipart/form-data image, levelId, subjectId, note? → 201 soru ayrıntısı. */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  const form = await request.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_REQUEST", "multipart/form-data bekleniyor.");
  const levelId = Number(form.get("levelId"));
  const subjectId = Number(form.get("subjectId"));
  if (!Number.isInteger(levelId) || !Number.isInteger(subjectId) || levelId <= 0 || subjectId <= 0) {
    throw new ApiError(422, "VALIDATION", "Kademe ve dersi seçin.", { subject: "Seçin." });
  }
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) throw new ApiError(422, "VALIDATION", "Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });
  const note = String(form.get("note") ?? "").trim();
  const question = await askPoolQuestion(user.id, { levelId, subjectId, note: note || null, image });
  return json(await studentQuestionJson(user.id, question.id), 201);
});

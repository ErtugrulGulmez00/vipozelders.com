import { z } from "zod";
import { requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { studentQuestionJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";
import { askFollowUp, cancelPoolQuestion, disputePoolAnswer, ratePoolAnswer } from "@/server/question-pool";

/** Soru ayrıntısı: çözüm, ek soru, puan ve yapılabilecekler (actions). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await studentQuestionJson(user.id, params.id));
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("followUp"), body: z.string() }),
  z.object({ action: z.literal("rate"), rating: z.number().int().min(1).max(5) }),
  z.object({ action: z.literal("dispute"), reason: z.string() }),
]);

/**
 * Soruyla ilgili işlem: { action: "cancel" } (kimse üstlenmediyse geri çek, kredi iade) · { action: "followUp", body }
 * (bir kez ek soru) · { action: "rate", rating: 1-5 } · { action: "dispute", reason } (süre içinde sorun bildir).
 */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(request, actionSchema);
  if (input.action === "cancel") await cancelPoolQuestion(user.id, params.id);
  if (input.action === "followUp") await askFollowUp(user.id, params.id, input.body);
  if (input.action === "rate") await ratePoolAnswer(user.id, params.id, input.rating);
  if (input.action === "dispute") await disputePoolAnswer(user.id, params.id, input.reason);
  return json(await studentQuestionJson(user.id, params.id));
});

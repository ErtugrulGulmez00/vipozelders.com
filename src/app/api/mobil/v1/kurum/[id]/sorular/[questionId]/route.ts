import { CenterError } from "@/server/center/errors";
import { withdrawQuestion } from "@/server/center/questions";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { assertPortalStudent } from "@/server/mobile/center";
import { ApiError, notFound } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Soruyu soran kişi, henüz cevaplanmamışsa geri çeker. */
export const DELETE = withUser<{ id: string; questionId: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  const question = await db.centerQuestion.findUnique({ where: { id: params.questionId }, select: { studentId: true } });
  if (!question) throw notFound("Soru bulunamadı.");
  await assertPortalStudent(user.id, params.id, question.studentId);
  try {
    await withdrawQuestion(user.id, params.questionId);
  } catch (error) {
    if (error instanceof CenterError) throw new ApiError(422, "RULE_VIOLATION", error.message);
    throw error;
  }
  return new Response(null, { status: 204 });
});

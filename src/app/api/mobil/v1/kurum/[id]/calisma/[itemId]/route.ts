import { z } from "zod";
import { portalStudentIdFor, setPlanItemDone } from "@/server/center/resources";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { assertPortalStudent } from "@/server/mobile/center";
import { json, notFound, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğrenci ya da velisi programdaki maddeyi tamamlandı / tamamlanmadı işaretler: { done } */
export const POST = withUser<{ id: string; itemId: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const { done } = await readBody(request, z.object({ done: z.boolean() }));
  const item = await db.centerStudyPlanItem.findUnique({ where: { id: params.itemId }, select: { id: true, studentId: true } });
  if (!item) throw notFound("Kayıt bulunamadı.");
  await assertPortalStudent(user.id, params.id, item.studentId);
  if (!(await portalStudentIdFor(user.id, item.studentId))) throw notFound("Kayıt bulunamadı.");
  await setPlanItemDone(item.id, done);
  return json({ ok: true, done });
});

import { z } from "zod";
import { portalStudentIdFor, saveResourceProgress } from "@/server/center/resources";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { assertPortalStudent } from "@/server/mobile/center";
import { json, notFound, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

const count = z.number().int().min(0).max(100_000);
const schema = z.object({
  rows: z.array(z.object({ topic: z.string().min(1).max(200), solved: count, correct: count, wrong: count, done: z.boolean() })).max(500),
});

/** Öğrenci ya da velisi atanmış kaynaktaki konu ilerlemesini girer (yalnızca kaynağın konuları kaydedilir). */
export const PUT = withUser<{ id: string; resourceId: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const { rows } = await readBody(request, schema);
  const row = await db.centerStudentResource.findUnique({ where: { id: params.resourceId }, select: { id: true, studentId: true } });
  if (!row) throw notFound("Kayıt bulunamadı.");
  await assertPortalStudent(user.id, params.id, row.studentId);
  if (!(await portalStudentIdFor(user.id, row.studentId))) throw notFound("Kayıt bulunamadı.");
  await saveResourceProgress(row.id, rows);
  return json({ ok: true });
});

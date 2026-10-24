import { z } from "zod";
import { db } from "@/server/db";
import { messageTeacher } from "@/server/messages";
import { requireRole } from "@/server/mobile/auth";
import { json, notFound, readBody } from "@/server/mobile/http";
import { threadJson } from "@/server/mobile/messages";
import { withUser } from "@/server/mobile/route";

/** Öğretmene ilk mesaj (ya da var olan konuşmaya ekleme): { body } → 201 konuşma. */
export const POST = withUser<{ slug: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const { body } = await readBody(request, z.object({ body: z.string() }));
  const teacher = await db.teacherProfile.findUnique({ where: { slug: params.slug }, select: { userId: true } });
  if (!teacher) throw notFound("Öğretmen bulunamadı.");
  const thread = await messageTeacher(user.id, teacher.userId, body);
  return json(await threadJson(user.id, thread.id), 201);
});

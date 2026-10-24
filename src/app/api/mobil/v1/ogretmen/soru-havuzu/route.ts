import { z } from "zod";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { teacherPoolJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";

/** Öğretmenin soru havuzu: eşleşen açık sorular, üstlendikleri ve çözdükleri, havuz kuralları. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "TEACHER");
  return json(await teacherPoolJson(user.id));
});

/** Havuza katılma / ayrılma: { answersPool } */
export const PUT = withUser(async ({ request, user }) => {
  requireRole(user, "TEACHER");
  const { answersPool } = await readBody(request, z.object({ answersPool: z.boolean() }));
  await db.teacherProfile.update({ where: { userId: user.id }, data: { answersPool } });
  return json(await teacherPoolJson(user.id));
});

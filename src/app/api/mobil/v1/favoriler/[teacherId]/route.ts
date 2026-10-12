import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { json, notFound } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

export const POST = withUser<{ teacherId: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  const teacher = await db.teacherProfile.findUnique({ where: { userId: params.teacherId }, select: { userId: true } });
  if (!teacher) throw notFound("Öğretmen bulunamadı.");
  await db.favorite.upsert({
    where: { studentId_teacherId: { studentId: user.id, teacherId: teacher.userId } },
    create: { studentId: user.id, teacherId: teacher.userId },
    update: {},
  });
  return json({ isFavorite: true });
});

export const DELETE = withUser<{ teacherId: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  await db.favorite.deleteMany({ where: { studentId: user.id, teacherId: params.teacherId } });
  return json({ isFavorite: false });
});

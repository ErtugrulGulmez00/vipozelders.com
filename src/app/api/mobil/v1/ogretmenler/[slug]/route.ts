import { db } from "@/server/db";
import { optionalUser } from "@/server/mobile/auth";
import { teacherOffersJson } from "@/server/mobile/commerce";
import { json, notFound } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";
import { teacherProfileJson } from "@/server/mobile/serialize";
import { getTeacherProfileBySlug, isTeacherPublic } from "@/server/teachers";

/** Öğretmen profili; paket indirimleri, soru abonelikleri, grup dersleri. Oturum açmış veli için favori durumu ve paketleri de döner. */
export const GET = publicRoute<{ slug: string }>(async ({ request, params }) => {
  const teacher = await getTeacherProfileBySlug(params.slug);
  if (!teacher || !isTeacherPublic(teacher)) throw notFound("Öğretmen bulunamadı.");
  const viewer = await optionalUser(request);
  const isFavorite =
    viewer?.role === "STUDENT"
      ? Boolean(await db.favorite.findUnique({ where: { studentId_teacherId: { studentId: viewer.id, teacherId: teacher.userId } } }))
      : false;
  const offers = await teacherOffersJson(teacher, viewer?.role === "STUDENT" ? viewer.id : null);
  return json({ ...teacherProfileJson(teacher), ...offers, isFavorite });
});

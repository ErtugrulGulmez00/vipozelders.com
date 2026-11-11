import { db } from "@/server/db";
import { json, notFound } from "@/server/mobile/http";
import { kocProgramJson, mobileCoachContext } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Koçun gördüğü haftalık program ve tüm görüşme notları. */
export const GET = withUser<{ id: string }>(
  async ({ request, user, params }) => {
    const ctx = await mobileCoachContext(user);
    const student = await db.centerStudent.findFirst({ where: { id: params.id, centerId: ctx.center.id }, select: { id: true } });
    if (!student) throw notFound("Öğrenci bulunamadı.");
    return json(await kocProgramJson(student.id, ctx.center.id, new URL(request.url).searchParams.get("hafta"), false));
  },
  { allowCenter: true },
);

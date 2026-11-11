import { z } from "zod";
import { setPlanItemDone } from "@/server/center/resources";
import { db } from "@/server/db";
import { json, notFound, readBody } from "@/server/mobile/http";
import { kocLink } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Program maddesini tamamlandı / tamamlanmadı işaretler (öğrenci ya da velisi). */
export const POST = withUser<{ id: string; itemId: string }>(
  async ({ request, user, params }) => {
    const { done } = await readBody(request, z.object({ done: z.boolean() }));
    const link = await kocLink(user.id, params.id);
    const item = await db.centerStudyPlanItem.findFirst({ where: { id: params.itemId, studentId: link.student.id }, select: { id: true } });
    if (!item) throw notFound("Görev bulunamadı.");
    await setPlanItemDone(item.id, done);
    return json({ ok: true });
  },
  { allowCenter: true },
);

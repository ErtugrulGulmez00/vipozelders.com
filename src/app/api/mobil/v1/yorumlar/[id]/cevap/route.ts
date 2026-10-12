import { z } from "zod";
import { requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { replyToReview } from "@/server/reviews";

/** Öğretmenin yoruma herkese açık cevabı (boş metin cevabı kaldırır). */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "TEACHER");
  const { reply } = await readBody(request, z.object({ reply: z.string().max(1000) }));
  await replyToReview(params.id, user.id, reply);
  return json({ ok: true });
});

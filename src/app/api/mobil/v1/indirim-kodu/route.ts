import { z } from "zod";
import { quoteDiscount } from "@/server/discount-quote";
import { requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

const schema = z.object({
  target: z.enum(["booking", "credits", "subscription", "group"]),
  code: z.string().max(30),
  // booking: offeringId · subscription: planId · group: courseId
  ref: z.string().max(60).optional(),
  duration: z.number().int().optional(),
  credits: z.number().int().optional(),
});

/**
 * İndirim kodunu ödeme öncesi dener (kayıt oluşturmaz; ödemede yeniden doğrulanır):
 * → { ok: true, discount, finalPrice, label, text } ya da { ok: false, error }.
 */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(request, schema);
  return json(await quoteDiscount(user.id, { ...input, ref: input.ref ?? "" }));
});

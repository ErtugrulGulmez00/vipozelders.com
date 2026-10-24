import { z } from "zod";
import { db } from "@/server/db";
import { clientIp, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { subscriptionJson, subscriptionsJson } from "@/server/mobile/commerce";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { createSubscription, startSubscriptionCheckout } from "@/server/subscriptions";

/** Aboneliklerim (aylık soru aboneliği): dönem, günlük hak, bugün kullanılan. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "STUDENT");
  return json(await subscriptionsJson(user.id));
});

const schema = z.object({
  planId: z.string().min(1),
  couponCode: z.string().trim().max(30).optional(),
  // Abonelik ödemeyle hemen başlar: ön bilgilendirme, mesafeli satış ve cayma hakkı onayı
  consent: z.literal(true, { error: "Ön bilgilendirme formunu, mesafeli satış sözleşmesini ve cayma hakkı bilgilendirmesini onaylayın." }),
});

/** Abonelik satın alma (yenileme de aynı uç: yeni dönem mevcut dönemin bitişinden başlar) → 201 { subscription, payment }. */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(request, schema);
  const created = await createSubscription(user.id, input.planId, input.couponCode ?? null);
  const redirectUrl = await startSubscriptionCheckout(created.id, user.id, clientIp(request) ?? "127.0.0.1");
  const sub = await db.questionSubscription.findUniqueOrThrow({ where: { id: created.id }, include: { teacher: { select: { slug: true, photoKey: true, user: { select: { firstName: true, lastName: true } } } } } });
  return json({ subscription: await subscriptionJson(sub), payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix() } }, 201);
});

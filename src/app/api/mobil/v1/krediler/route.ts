import { z } from "zod";
import { createCreditPurchase, startCreditCheckout } from "@/server/credits";
import { clientIp, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { creditsJson, purchaseJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";

/** Soru kredisi: bakiye, paketler, soru gönderilebilecek dersler, satın almalar ve hareketler. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "STUDENT");
  return json(await creditsJson(user.id));
});

/**
 * Kredi paketi satın alma: { credits, consent: true } → { purchase, payment }. Ödeme randevudaki gibi WebView'da
 * yapılır; dönüş adresine gelince GET /krediler/{id} ile sonuç sorgulanır.
 */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(
    request,
    z.object({
      credits: z.number().int().positive(),
      couponCode: z.string().trim().max(30).optional(),
      consent: z.literal(true, { error: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." }),
    }),
  );
  const purchase = await createCreditPurchase(user.id, input.credits, input.couponCode ?? null);
  const redirectUrl = await startCreditCheckout(purchase.id, user.id, clientIp(request) ?? "127.0.0.1");
  return json({ purchase: purchaseJson(purchase), payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix() } }, 201);
});

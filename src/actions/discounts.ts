"use server";

import { actionUser } from "@/server/auth/current-user";
import { quoteDiscount, type CouponCheck, type CouponQuoteInput } from "@/server/discount-quote";

export type { CouponCheck };

/** Ödeme formundaki "Uygula": indirimi hesaplar (kayıt oluşturmaz; ödemede yeniden doğrulanır). */
export async function checkCouponAction(input: CouponQuoteInput): Promise<CouponCheck> {
  const user = await actionUser("STUDENT");
  if (!user) return { ok: false, error: "İndirim kodu için veli/öğrenci hesabıyla giriş yapın." };
  return quoteDiscount(user.id, input);
}

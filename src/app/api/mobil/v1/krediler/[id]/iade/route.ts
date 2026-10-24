import { formatMoney } from "@/lib/money";
import { refundCreditPurchase } from "@/server/credits";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Kullanılmayan kredilerin iadesi (süre içinde; kullanılanlar tek soru fiyatından düşülür). */
export const POST = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  const amount = await refundCreditPurchase(params.id, user.id);
  return json({ amount, message: `${formatMoney(amount)} kartınıza iade ediliyor.` });
});

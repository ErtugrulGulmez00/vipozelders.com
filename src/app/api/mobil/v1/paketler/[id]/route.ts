import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/mobile/auth";
import { packageStatusJson } from "@/server/mobile/commerce";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { refundPackage } from "@/server/packages";

/** Paketin durumu (ödeme sonrası sorgulanır) ve kalan ders. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await packageStatusJson(user.id, params.id));
});

/** Kalan derslerin iadesi (kullanılan dersler indirimsiz ücretten düşülür). */
export const POST = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  const amount = await refundPackage(params.id, user.id);
  return json({ amount, message: `${formatMoney(amount)} kartınıza iade ediliyor.` });
});

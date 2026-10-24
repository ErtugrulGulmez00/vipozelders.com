import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { purchaseStatusJson } from "@/server/mobile/pool";
import { withUser } from "@/server/mobile/route";

/** Kredi paketi satın almasının durumu (ödeme sonrası sorgulanır). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await purchaseStatusJson(user.id, params.id));
});

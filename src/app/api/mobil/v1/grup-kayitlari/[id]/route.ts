import { cancelEnrollment } from "@/server/groups";
import { requireRole } from "@/server/mobile/auth";
import { enrollmentStatusJson } from "@/server/mobile/commerce";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Grup dersi kaydının durumu (ödeme sonrası sorgulanır). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await enrollmentStatusJson(user.id, params.id));
});

/** Kaydı iptal eder: ilk oturumdan önce tam iade; davet / ödeme bekleyen kayıt yalnızca kapanır. */
export const DELETE = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  await cancelEnrollment(user.id, params.id);
  return json(await enrollmentStatusJson(user.id, params.id));
});

import { requireRole } from "@/server/mobile/auth";
import { childrenJson } from "@/server/mobile/center";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Velinin kurum (etüt merkezi) portalına bağlı öğrencileri. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "STUDENT");
  return json(await childrenJson(user.id));
});

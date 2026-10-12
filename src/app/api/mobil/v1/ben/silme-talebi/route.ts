import { z } from "zod";
import { DELETION_REQUEST_MESSAGE, requestAccountDeletion } from "@/server/account-deletion";
import { clientIp } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Hesap silme talebi (App Store ve Google Play zorunluluğu). */
export const POST = withUser(
  async ({ request, user }) => {
    const { reason } = await readBody(request, z.object({ reason: z.string().trim().max(500).optional() }));
    await requestAccountDeletion(user, reason, { ipAddress: clientIp(request), source: "mobile" });
    return json({ message: DELETION_REQUEST_MESSAGE }, 202);
  },
  { allowPasswordChange: true },
);

import { z } from "zod";
import { acceptInvite } from "@/server/center/portal";
import { CenterError } from "@/server/center/errors";
import { requireRole } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

const schema = z.object({ token: z.string().trim().min(10, "Davet kodu geçersiz.").max(200) });

/** Kurumun gönderdiği veli portalı davetini kabul eder (bağlantıdaki /kurum-davet/<token> kısmı). */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  const { token } = await readBody(request, schema);
  try {
    const guardian = await acceptInvite(user.id, token);
    return json({ id: guardian.id });
  } catch (error) {
    if (error instanceof CenterError) throw new ApiError(422, "INVITE_INVALID", error.message);
    throw error;
  }
});

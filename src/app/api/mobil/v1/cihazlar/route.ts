import { z } from "zod";
import { db } from "@/server/db";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Push bildirimi için Firebase (FCM) cihaz anahtarını kaydeder. Aynı anahtar başka hesaba geçmişse taşınır. */
export const POST = withUser(
  async ({ request, user }) => {
    const input = await readBody(request, z.object({ token: z.string().min(20).max(4096), platform: z.enum(["android", "ios"]) }));
    await db.device.upsert({
      where: { token: input.token },
      create: { userId: user.id, token: input.token, platform: input.platform },
      update: { userId: user.id, platform: input.platform, lastSeenAt: new Date() },
    });
    return json({ ok: true }, 201);
  },
  { allowPasswordChange: true, allowCenter: true },
);

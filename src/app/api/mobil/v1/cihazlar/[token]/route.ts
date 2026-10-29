import { db } from "@/server/db";
import { withUser } from "@/server/mobile/route";

export const DELETE = withUser<{ token: string }>(
  async ({ user, params }) => {
    await db.device.deleteMany({ where: { token: decodeURIComponent(params.token), userId: user.id } });
    return new Response(null, { status: 204 });
  },
  { allowPasswordChange: true, allowCenter: true },
);

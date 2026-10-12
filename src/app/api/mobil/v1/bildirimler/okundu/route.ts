import { z } from "zod";
import { db } from "@/server/db";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Bildirimleri okundu işaretler: { ids: [...] } verilirse yalnızca onları, verilmezse hepsini. */
export const POST = withUser(
  async ({ request, user }) => {
    const { ids } = await readBody(request, z.object({ ids: z.array(z.string()).max(200).optional() }));
    await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    return json({ unread: await db.notification.count({ where: { userId: user.id, readAt: null } }) });
  },
  { allowPasswordChange: true },
);

import { z } from "zod";
import { db } from "@/server/db";
import { json, readBody } from "@/server/mobile/http";
import { notificationSideWhere } from "@/server/mobile/notifications";
import { withUser } from "@/server/mobile/route";

/** Bildirimleri okundu işaretler: { ids: [...] } verilirse yalnızca onları, verilmezse hepsini (taraf verilirse o tarafın hepsini). */
export const POST = withUser(
  async ({ request, user }) => {
    const { ids, taraf } = await readBody(request, z.object({ ids: z.array(z.string()).max(200).optional(), taraf: z.enum(["kurum", "ozel"]).optional() }));
    const scope = await notificationSideWhere(user, taraf);
    await db.notification.updateMany({ where: { userId: user.id, readAt: null, ...scope, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
    return json({ unread: await db.notification.count({ where: { userId: user.id, readAt: null, ...scope } }) });
  },
  { allowPasswordChange: true, allowCenter: true },
);

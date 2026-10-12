import { db } from "@/server/db";
import { json, pageParam } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { notificationJson } from "@/server/mobile/serialize";

const PAGE_SIZE = 30;

/** Bildirimler (yeniden eskiye). target alanı uygulamada açılacak ekranı söyler. */
export const GET = withUser(
  async ({ request, user }) => {
    const page = pageParam(new URL(request.url));
    const [rows, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return json({ items: rows.slice(0, PAGE_SIZE).map(notificationJson), unread, nextPage: rows.length > PAGE_SIZE ? page + 1 : null });
  },
  { allowPasswordChange: true },
);

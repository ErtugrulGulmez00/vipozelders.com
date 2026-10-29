import { db } from "@/server/db";
import { json, pageParam } from "@/server/mobile/http";
import { notificationSideWhere } from "@/server/mobile/notifications";
import { withUser } from "@/server/mobile/route";
import { notificationJson } from "@/server/mobile/serialize";

const PAGE_SIZE = 30;

/** Bildirimler (yeniden eskiye). target alanı uygulamada açılacak ekranı söyler. ?taraf=kurum|ozel ile tarafa göre süzülür. */
export const GET = withUser(
  async ({ request, user }) => {
    const url = new URL(request.url);
    const page = pageParam(url);
    const scope = await notificationSideWhere(user, url.searchParams.get("taraf"));
    const [rows, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id, ...scope }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 }),
      db.notification.count({ where: { userId: user.id, readAt: null, ...scope } }),
    ]);
    return json({ items: rows.slice(0, PAGE_SIZE).map(notificationJson), unread, nextPage: rows.length > PAGE_SIZE ? page + 1 : null });
  },
  { allowPasswordChange: true, allowCenter: true },
);

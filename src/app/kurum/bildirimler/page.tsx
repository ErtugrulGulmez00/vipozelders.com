import type { Metadata } from "next";
import { NotificationsPage } from "@/components/panel/notifications-list";
import { notificationScope } from "@/lib/sides";
import { requireCenter } from "@/server/center/context";
import { sideFacts } from "@/server/sides";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function CenterNotificationsPage() {
  const ctx = await requireCenter();
  return <NotificationsPage userId={ctx.user.id} scope={notificationScope(await sideFacts(ctx.user.id, ctx.user.role), "kurum")} />;
}

import type { Metadata } from "next";
import { NotificationsPage } from "@/components/panel/notifications-list";
import { notificationScope } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { sideFacts } from "@/server/sides";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function PortalNotificationsPage() {
  const user = await requireRole("STUDENT");
  return <NotificationsPage userId={user.id} scope={notificationScope(await sideFacts(user.id, user.role), "kurum")} />;
}

import type { Metadata } from "next";
import { NotificationsPage } from "@/components/panel/notifications-list";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function AdminNotificationsPage() {
  const user = await requireRole("ADMIN");
  return <NotificationsPage userId={user.id} />;
}

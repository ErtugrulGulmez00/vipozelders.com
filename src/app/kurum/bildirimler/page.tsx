import type { Metadata } from "next";
import { NotificationsPage } from "@/components/panel/notifications-list";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function CenterNotificationsPage() {
  const ctx = await requireCenter();
  return <NotificationsPage userId={ctx.user.id} />;
}

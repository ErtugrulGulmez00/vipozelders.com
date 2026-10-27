import type { Metadata } from "next";
import { StudentSettings } from "@/components/panel/student-settings";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Hesap ayarları" };

export default async function PortalSettingsPage() {
  const user = await requireRole("STUDENT");
  return <StudentSettings userId={user.id} side="kurum" />;
}

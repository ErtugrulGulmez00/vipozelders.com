import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { loadSettings } from "@/server/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Site ayarları" };

export default async function SettingsPage() {
  await requireRole("ADMIN");
  const settings = await loadSettings();
  return (
    <>
      <PageHeader title="Site ayarları" />
      <SettingsForm settings={settings} />
    </>
  );
}

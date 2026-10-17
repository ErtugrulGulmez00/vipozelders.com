import { requireCenterModule } from "@/server/center/context";

// Kurum bu modülü ayarlardan kapattıysa sayfaları açılmaz.
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireCenterModule("etutler");
  return children;
}

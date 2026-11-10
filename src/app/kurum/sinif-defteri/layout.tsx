import { requireCenterModule, requireCenterSection } from "@/server/center/context";

// Kurum bu modülü ayarlardan kapattıysa sayfaları açılmaz.
export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireCenterSection("sinif-defteri");
  await requireCenterModule("sinif-defteri");
  return children;
}

import { requireCenterSection } from "@/server/center/context";

// Pi Koç hesabında bu bölüm açılmaz.
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireCenterSection("siniflar");
  return children;
}

import { requireCenterSection } from "@/server/center/context";

// Dershane paketine özel bölüm: Etüt Merkezi paketinde sayfaları açılmaz.
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireCenterSection("derslikler");
  return children;
}

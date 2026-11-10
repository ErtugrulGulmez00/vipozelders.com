import { requireCenterSection } from "@/server/center/context";

// Kurum türünde olmayan bölüm (Pi Koç ya da etüt merkezinde dershane bölümleri) açılmaz.
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireCenterSection("siniflar");
  return children;
}

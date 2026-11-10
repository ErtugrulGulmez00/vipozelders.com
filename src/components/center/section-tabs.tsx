import { Tabs } from "@/components/center/center-ui";
import { moduleEnabled } from "@/lib/center/modules";
import type { CenterContext } from "@/server/center/context";

// Menüde tek başlık altında toplanan yakın bölümler sayfanın üstünde sekme olarak görünür.
type Group = "ogrenciler" | "kocluk" | "iletisim";

export function SectionTabs({ ctx, group, active }: { ctx: CenterContext; group: Group; active: string }) {
  const tabs =
    group === "ogrenciler"
      ? [
          { key: "ogrenciler", label: "Öğrenci listesi", href: "/kurum/ogrenciler" },
          { key: "siniflar", label: "Sınıflar ve gruplar", href: "/kurum/siniflar" },
        ]
      : group === "kocluk"
        ? [
            ...(ctx.can("coaching.manage") && moduleEnabled(ctx.center, "kocluk") ? [{ key: "kocluk", label: "Koç görüşmeleri", href: "/kurum/kocluk" }] : []),
            ...(ctx.can("resources.manage") && moduleEnabled(ctx.center, "kaynaklar") ? [{ key: "kaynaklar", label: "Kaynaklar ve kitaplar", href: "/kurum/kaynaklar" }] : []),
          ]
        : [
            { key: "duyurular", label: "Duyurular", href: "/kurum/duyurular" },
            { key: "mesajlar", label: "Gönderilen mesajlar", href: "/kurum/mesajlar" },
          ];
  if (tabs.length < 2) return null;
  return <Tabs tabs={tabs} active={active} />;
}

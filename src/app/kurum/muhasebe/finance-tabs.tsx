import { Tabs } from "@/components/center/center-ui";
import type { CenterContext } from "@/server/center/context";

export function FinanceTabs({ ctx, active }: { ctx: CenterContext; active: string }) {
  return (
    <Tabs
      active={active}
      tabs={[
        { key: "ozet", label: "Özet", href: "/kurum/muhasebe" },
        ...(ctx.can("finance.edit") ? [{ key: "tahsilat", label: "Tahsilat", href: "/kurum/muhasebe/tahsilat" }] : []),
        { key: "gecikenler", label: "Gecikenler", href: "/kurum/muhasebe/gecikenler" },
        ...(ctx.can("expenses.manage") ? [{ key: "giderler", label: "Giderler", href: "/kurum/muhasebe/giderler" }] : []),
      ]}
    />
  );
}

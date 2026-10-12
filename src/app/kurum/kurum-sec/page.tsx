import type { Metadata } from "next";
import { switchCenterAction } from "@/actions/center/organization";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { CENTER_ROLE_LABEL } from "@/lib/center/permissions";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "Kurum değiştir" };

export default async function SwitchCenterPage() {
  const ctx = await requireCenter();
  return (
    <>
      <PageHeader title="Kurum değiştir" description="Birden fazla kurumda görevlisiniz; çalışmak istediğiniz kurumu seçin." />
      <Card className="divide-y divide-slate-100">
        {ctx.memberships.map((m) => (
          <form key={m.centerId} action={switchCenterAction} className="flex items-center justify-between gap-3 px-5 py-4">
            <input type="hidden" name="centerId" value={m.centerId} />
            <div>
              <p className="font-semibold text-slate-900">{m.centerName}</p>
              <p className="text-xs text-slate-500">{CENTER_ROLE_LABEL[m.role]}</p>
            </div>
            {m.centerId === ctx.center.id ? (
              <Badge tone="brand">Seçili</Badge>
            ) : (
              <Button type="submit" size="sm" variant="outline">
                Bu kuruma geç
              </Button>
            )}
          </form>
        ))}
      </Card>
    </>
  );
}

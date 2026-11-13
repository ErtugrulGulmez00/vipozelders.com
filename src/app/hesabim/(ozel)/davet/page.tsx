import { Gift } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { ensureReferralCode } from "@/server/discounts";
import { appUrl } from "@/server/email";
import { loadSettings } from "@/server/settings";
import { CopyInviteLink } from "./copy-link";

export const metadata: Metadata = { title: "Arkadaşını davet et" };

export default async function InvitePage() {
  const user = await requireRole("STUDENT");
  const settings = await loadSettings();
  // Kampanya kapalıyken (siteden satış yok) sayfa yok
  if (!settings.referralEnabled) redirect("/hesabim");
  const [code, invited] = await Promise.all([
    ensureReferralCode(user.id),
    db.user.count({ where: { referredById: user.id } }),
  ]);
  const url = appUrl(`/kayit?davet=${code}`);
  return (
    <>
      <PageHeader title="Arkadaşını davet et" description="Bağlantınızla kayıt olan arkadaşınız ilk siparişinde indirim kazanır." />
      {!settings.referralEnabled ? <Alert tone="info" className="mb-6">Arkadaşını getir kampanyası şu an kapalı.</Alert> : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Arkadaşınıza" value={`%${settings.referralDiscountPercent} indirim`} hint="İlk siparişinde, kod gerekmeden" icon={<Gift className="size-5" />} />
        <StatCard label="Davetleriniz" value={`${invited} kayıt`} />
      </div>
      <Card>
        <CardHeader title="Davet bağlantınız" description={`Davet kodunuz: ${code}`} />
        <CardBody>
          <CopyInviteLink url={url} text={`${settings.siteName}'te onaylı öğretmenlerle ders. Bu bağlantıyla kayıt olursan ilk siparişinde %${settings.referralDiscountPercent} indirim kazanırsın:`} />
        </CardBody>
      </Card>
    </>
  );
}

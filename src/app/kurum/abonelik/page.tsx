import type { Metadata } from "next";
import { RateBar } from "@/components/center/center-ui";
import { EditionCards, TierCards } from "@/components/center/pricing";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL } from "@/lib/center/labels";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { centerPlans, subscriptionLabel } from "@/server/center/plans";
import { db } from "@/server/db";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = { title: "Abonelik" };

export default async function SubscriptionPage() {
  const ctx = await requireCenter("subscription.view");
  const [settings, activeStudents, staff, payments] = await Promise.all([
    getSiteSettings(),
    db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } }),
    db.centerMember.count({ where: { centerId: ctx.center.id, isActive: true } }),
    db.centerSubscriptionPayment.findMany({ where: { centerId: ctx.center.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const access = CENTER_ACCESS_LABEL[ctx.access.state];
  const plans = centerPlans(settings, ctx.center.edition);
  const usage = activeStudents / Math.max(ctx.center.studentLimit, 1);
  return (
    <>
      <PageHeader title="Abonelik" description={`${settings.siteName} kurum paneli planınız ve ödemeleriniz`} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Planınız" action={<Badge tone={access.tone}>{access.label}</Badge>} />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                { label: "Paket", value: subscriptionLabel(settings, ctx.center.edition, ctx.center.plan) },
                {
                  label: ctx.center.status === "TRIAL" ? "Deneme bitişi" : "Geçerlilik",
                  value: ctx.access.endsAt ? `${formatDate(ctx.access.endsAt)}${ctx.access.daysLeft !== null && ctx.access.daysLeft > 0 ? ` (${ctx.access.daysLeft} gün)` : ""}` : "Süresiz",
                },
                { label: "Personel", value: `${staff} aktif hesap` },
              ]}
            />
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-600">Aktif öğrenci</span>
                <span className="font-semibold text-slate-900">
                  {activeStudents} / {ctx.center.studentLimit}
                </span>
              </div>
              <RateBar value={usage} tone={usage > 0.9 ? "rose" : usage > 0.75 ? "amber" : "brand"} />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Ödeme / yenileme" />
          <CardBody className="space-y-3 text-sm text-slate-700">
            <p>Aboneliğinizi havale / EFT ile yenileyebilirsiniz. Açıklamaya kurum adınızı yazın; ödemeniz kaydedilince süreniz otomatik uzar.</p>
            {settings.centerBankInfo ? <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 font-mono text-xs">{settings.centerBankInfo}</p> : null}
            <p>
              Sorularınız için: {settings.contactEmail}
              {settings.contactPhone ? ` · ${settings.contactPhone}` : ""}
            </p>
          </CardBody>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900">Paketler</h2>
      <EditionCards current={ctx.center.edition} />
      <h2 className="mb-1 mt-8 text-lg font-bold text-slate-900">Öğrenci sayısına göre fiyat</h2>
      <p className="mb-4 text-sm text-slate-500">Paket ya da kademe değiştirmek için bizimle iletişime geçin; ödemeniz kaydedilince yeni paketiniz hemen açılır.</p>
      <TierCards plans={plans} current={ctx.center.plan} />
      {payments.length ? (
        <Card className="mt-8">
          <CardHeader title="Abonelik ödemeleriniz" />
          <Table>
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th>Dönem</Th>
                <Th>Şekil</Th>
                <Th className="text-right">Tutar</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td className="text-xs">{formatDate(p.createdAt)}</Td>
                  <Td className="text-xs">
                    {formatDate(p.periodStart)} – {formatDate(p.periodEnd)} ({p.months} ay)
                  </Td>
                  <Td className="text-xs">{p.method}</Td>
                  <Td className="text-right font-semibold">{formatMoney(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </>
  );
}

import { Check } from "lucide-react";
import type { Metadata } from "next";
import { RateBar } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { CENTER_ACCESS_LABEL, CENTER_PLAN_LABEL } from "@/lib/center/labels";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { centerPlans } from "@/server/center/plans";
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
  const plans = centerPlans(settings);
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
                { label: "Plan", value: CENTER_PLAN_LABEL[ctx.center.plan] },
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
      <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900">Planlar</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.plan} className={cn("rounded-2xl border bg-white p-5", plan.plan === ctx.center.plan ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200")}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-slate-900">{plan.name}</p>
              {plan.plan === ctx.center.plan ? <Badge tone="brand">Mevcut plan</Badge> : null}
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{plan.priceTl !== null ? `${formatMoney(plan.priceTl * 100)}` : "Teklif"}</p>
            <p className="text-xs text-slate-500">{plan.priceTl !== null ? "aylık, KDV dahil" : "kurumunuza özel"}</p>
            {plan.yearlyPriceTl ? <p className="mt-1 text-sm font-semibold text-emerald-700">Yıllık {formatMoney(plan.yearlyPriceTl * 100)}</p> : null}
            <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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

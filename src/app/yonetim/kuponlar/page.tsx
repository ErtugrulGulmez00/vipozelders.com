import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";
import { TARGET_LABELS, type DiscountTarget } from "@/server/discounts";
import { CreateCouponForm, ToggleCouponForm } from "./coupon-forms";

export const metadata: Metadata = { title: "İndirim kodları" };

export default async function CouponsPage() {
  const [coupons, usage, referral] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.couponRedemption.groupBy({ by: ["couponId"], where: { couponId: { not: null } }, _count: true, _sum: { amount: true } }),
    db.couponRedemption.aggregate({ where: { source: "referral" }, _count: true, _sum: { amount: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.couponId, u]));
  const total = usage.reduce((t, u) => t + (u._sum.amount ?? 0), 0);
  return (
    <>
      <PageHeader title="İndirim kodları" description="Kampanya kodları ve arkadaşını getir indirimleri. Kullanım, ödeme tamamlandığında sayılır." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Kod indirimi" value={formatMoney(total)} hint={`${usage.reduce((t, u) => t + u._count, 0)} kullanım`} />
        <StatCard label="Davet indirimi" value={formatMoney(referral._sum.amount ?? 0)} hint={`${referral._count} ilk sipariş`} />
        <StatCard label="Kod" value={coupons.length} />
      </div>
      <Card className="mb-6">
        <CardHeader title="Yeni kod" />
        <CardBody>
          <CreateCouponForm />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Kodlar" />
        {coupons.length === 0 ? (
          <EmptyState title="Henüz kod yok" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {coupons.map((c) => {
              const u = used.get(c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span>
                    <span className="font-mono font-semibold text-slate-900">{c.code}</span> · {c.kind === "PERCENT" ? `%${c.value}` : formatMoney(c.value)}
                    {c.maxDiscount ? ` (en fazla ${formatMoney(c.maxDiscount)})` : ""}
                    <span className="block text-xs text-slate-500">
                      {c.targets.length ? c.targets.map((t) => TARGET_LABELS[t as DiscountTarget] ?? t).join(", ") : "Tüm satışlar"}
                      {c.minAmount ? ` · en az ${formatMoney(c.minAmount)}` : ""}
                      {c.firstOrderOnly ? " · ilk sipariş" : ""} · {u?._count ?? 0}
                      {c.maxUses ? `/${c.maxUses}` : ""} kullanım ({formatMoney(u?._sum.amount ?? 0)})
                      {c.endsAt ? ` · bitiş ${formatDate(c.endsAt)}` : ""}
                      {c.description ? ` · ${c.description}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge tone={c.isActive ? "green" : "slate"}>{c.isActive ? "Açık" : "Durdu"}</Badge>
                    <ToggleCouponForm id={c.id} active={c.isActive} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

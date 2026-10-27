import { Check } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { CENTER_EDITIONS, EDITIONS, type CenterEditionName } from "@/lib/center/editions";
import { formatMoney } from "@/lib/money";
import type { CenterPlanInfo, CenterPlanName } from "@/server/center/plans";

// Kurum paketleri ve kapasite kademeleri: "Kurumlar için" sayfasında ve kurumun abonelik sayfasında.

/** İki paketin özellikleri yan yana. */
export function EditionCards({ current, cta }: { current?: CenterEditionName; cta?: { href: string; label: string } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {CENTER_EDITIONS.map((edition) => {
        const info = EDITIONS[edition];
        const isCurrent = current === edition;
        return (
          <div key={edition} className={cn("flex flex-col rounded-2xl border bg-white p-6", isCurrent || (!current && edition === "DERSHANE") ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-bold text-slate-900">{info.name} paketi</p>
              {isCurrent ? <Badge tone="brand">Mevcut paketiniz</Badge> : !current && edition === "DERSHANE" ? <Badge tone="brand">Kapsayıcı</Badge> : null}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{info.tagline}</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
              {info.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            {cta ? (
              <a href={cta.href} className={buttonClasses(edition === "DERSHANE" ? "primary" : "outline", "md", "mt-6 w-full")}>
                {cta.label}
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Öğrenci sayısına göre fiyatlar (iki pakette aynı). */
export function TierCards({ plans, current }: { plans: CenterPlanInfo[]; current?: CenterPlanName }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => {
        const isCurrent = current === plan.plan;
        const yearlySaving = plan.yearlyPriceTl ? plan.priceTl * 12 - plan.yearlyPriceTl : 0;
        return (
          <div key={plan.plan} className={cn("relative rounded-2xl border bg-white p-5", isCurrent || (!current && plan.highlight) ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200")}>
            {isCurrent ? (
              <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">Mevcut kademe</span>
            ) : !current && plan.highlight ? (
              <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">En çok tercih edilen</span>
            ) : null}
            <p className="font-bold text-slate-900">{plan.name}</p>
            <span className="mt-2 inline-block rounded-full bg-gold-50 px-2 py-0.5 text-xs font-bold text-gold-700">İndirimli</span>
            <p className="mt-1 text-2xl font-black text-slate-900">{formatMoney(plan.priceTl * 100)}</p>
            <p className="text-xs text-slate-500">aylık · KDV dahil</p>
            {plan.yearlyPriceTl ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Yıllık <span className="font-bold">{formatMoney(plan.yearlyPriceTl * 100)}</span>
                {yearlySaving > 0 ? <span className="block text-xs text-emerald-700">{formatMoney(yearlySaving * 100)} tasarruf</span> : null}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

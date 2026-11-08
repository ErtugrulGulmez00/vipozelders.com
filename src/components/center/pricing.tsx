import { Check } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { CENTER_PACKAGE } from "@/lib/center/editions";
import { formatMoney } from "@/lib/money";
import type { CenterPlanInfo, CenterPlanName } from "@/server/center/plans";

// Kurum paketi ve kapasite kademeleri: "Kurumlar için" sayfasında ve kurumun abonelik sayfasında.
// cta verilirse düğmeler başvuru formuna öğrenci sayısını seçili olarak götürür (?ogrenci=…#basvuru).

/** Başvuru formundaki "Öğrenci sayısı" seçeneği, kademeye göre */
export const TIER_STUDENT_OPTION: Record<CenterPlanName, string> = {
  STARTER: "20’ye kadar",
  PRO: "21-100",
  BUSINESS: "101-200",
  ENTERPRISE: "200’den fazla",
};

const applyHref = (plan: CenterPlanName) => `?${new URLSearchParams({ ogrenci: TIER_STUDENT_OPTION[plan] }).toString()}#basvuru`;

/** Paketin özellikleri; fromPrice verilirse "aylık ₺… ’den başlayan". */
export function PackageCard({ current, cta, fromPrice }: { current?: boolean; cta?: string; fromPrice?: number }) {
  return (
    <div className="rounded-2xl border border-brand-500 bg-white p-6 ring-2 ring-brand-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">{CENTER_PACKAGE.name} paketi</p>
          <p className="mt-0.5 text-sm text-slate-500">{CENTER_PACKAGE.tagline}</p>
        </div>
        {current ? <Badge tone="brand">Mevcut paketiniz</Badge> : null}
        {fromPrice ? (
          <p className="text-sm text-slate-600">
            aylık <span className="text-2xl font-black text-slate-900">{formatMoney(fromPrice * 100)}</span>’den başlayan
          </p>
        ) : null}
      </div>
      <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        {CENTER_PACKAGE.features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {f}
          </li>
        ))}
      </ul>
      {cta ? (
        <Link href="#basvuru" className={buttonClasses("primary", "md", "mt-6 w-full sm:w-auto")}>
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

/** Öğrenci sayısına göre fiyatlar. */
export function TierCards({ plans, current, cta }: { plans: CenterPlanInfo[]; current?: CenterPlanName; cta?: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => {
        const isCurrent = current === plan.plan;
        const yearlySaving = plan.yearlyPriceTl ? plan.priceTl * 12 - plan.yearlyPriceTl : 0;
        return (
          <div key={plan.plan} className={cn("relative flex flex-col rounded-2xl border bg-white p-5", isCurrent || (!current && plan.highlight) ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200")}>
            {isCurrent ? (
              <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">Mevcut kademe</span>
            ) : !current && plan.highlight ? (
              <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">En çok tercih edilen</span>
            ) : null}
            <p className="font-bold text-slate-900">{plan.name}</p>
            {plan.upsell ? (
              <span className="mt-2 inline-block w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                {plan.upsell.from} paketini aylık ödemekle aynı fiyata {plan.upsell.ratio} kat kapasite
              </span>
            ) : plan.yearlyPriceTl ? (
              <span className="mt-2 inline-block w-fit rounded-full bg-gold-50 px-2 py-0.5 text-xs font-bold text-gold-700">İndirimli</span>
            ) : null}
            {plan.yearlyPriceTl ? (
              <>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {formatMoney(plan.yearlyPriceTl * 100)}
                  <span className="text-sm font-semibold text-slate-500"> / yıl</span>
                </p>
                <p className="text-xs text-slate-500">aylık {formatMoney(Math.round(plan.yearlyPriceTl / 12) * 100)}’ye denk gelir · peşin · KDV dahil</p>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  ya da aylık <span className="font-bold">{formatMoney(plan.priceTl * 100)}</span>
                  {yearlySaving > 0 ? <span className="block text-xs text-emerald-700">Yıllıkta {formatMoney(yearlySaving * 100)} tasarruf</span> : null}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {formatMoney(plan.priceTl * 100)}
                  <span className="text-sm font-semibold text-slate-500"> / ay</span>
                </p>
                <p className="text-xs text-slate-500">yalnızca aylık ödeme · KDV dahil</p>
              </>
            )}
            {cta ? (
              <Link href={applyHref(plan.plan)} className={buttonClasses(!current && plan.highlight ? "primary" : "outline", "sm", "mt-4 w-full")}>
                {cta}
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

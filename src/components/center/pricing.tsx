"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { CENTER_EDITIONS, EDITIONS, type CenterEditionName } from "@/lib/center/editions";
import { formatMoney } from "@/lib/money";
import type { CenterPlanInfo, CenterPlanName } from "@/server/center/plans";

// Kurum paketleri ve kapasite kademeleri: "Kurumlar için" sayfasında ve kurumun abonelik sayfasında.
// cta verilirse düğmeler başvuru formuna paket ve öğrenci sayısını seçili olarak götürür (?paket=…&ogrenci=…#basvuru).

/** Başvuru formundaki "Öğrenci sayısı" seçeneği, kademeye göre */
export const TIER_STUDENT_OPTION: Record<CenterPlanName, string> = {
  STARTER: "20’ye kadar",
  PRO: "21-100",
  BUSINESS: "101-200",
  ENTERPRISE: "200’den fazla",
};

const applyHref = (edition: CenterEditionName, plan?: CenterPlanName) =>
  `?${new URLSearchParams({ paket: edition, ...(plan ? { ogrenci: TIER_STUDENT_OPTION[plan] } : {}) }).toString()}#basvuru`;

/** İki paketin özellikleri yan yana; fromPrice verilirse "aylık ₺… ’den başlayan". */
export function EditionCards({ current, cta, fromPrice }: { current?: CenterEditionName; cta?: string; fromPrice?: Record<CenterEditionName, number> }) {
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
            {fromPrice ? (
              <p className="mt-3 text-sm text-slate-600">
                aylık <span className="text-2xl font-black text-slate-900">{formatMoney(fromPrice[edition] * 100)}</span>’den başlayan
              </p>
            ) : null}
            <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
              {info.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            {cta ? (
              <Link href={applyHref(edition)} className={buttonClasses(edition === "DERSHANE" ? "primary" : "outline", "md", "mt-6 w-full")}>
                {cta}
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Öğrenci sayısına göre fiyatlar. */
export function TierCards({ plans, current, edition, cta }: { plans: CenterPlanInfo[]; current?: CenterPlanName; edition?: CenterEditionName; cta?: string }) {
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
            ) : (
              <span className="mt-2 inline-block w-fit rounded-full bg-gold-50 px-2 py-0.5 text-xs font-bold text-gold-700">İndirimli</span>
            )}
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
            {cta && edition ? (
              <Link href={applyHref(edition, plan.plan)} className={buttonClasses(!current && plan.highlight ? "primary" : "outline", "sm", "mt-4 w-full")}>
                {cta}
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** "Kurumlar için" fiyat tablosu: paket seçimiyle (Etüt Merkezi / Dershane) fiyatlar değişir. */
export function PricingTable({ plans, cta }: { plans: Record<CenterEditionName, CenterPlanInfo[]>; cta: string }) {
  const [edition, setEdition] = useState<CenterEditionName>("DERSHANE");
  return (
    <>
      <div role="radiogroup" aria-label="Paket" className="mb-6 inline-flex rounded-xl bg-slate-100 p-1">
        {CENTER_EDITIONS.map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={edition === e}
            onClick={() => setEdition(e)}
            className={cn("min-h-11 rounded-lg px-4 text-sm font-semibold", edition === e ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900")}
          >
            {EDITIONS[e].name}
          </button>
        ))}
      </div>
      <TierCards plans={plans[edition]} edition={edition} cta={cta} />
    </>
  );
}

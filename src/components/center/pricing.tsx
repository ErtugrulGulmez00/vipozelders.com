import { Check, MessageCircle } from "lucide-react";
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
  STARTER: "50’ye kadar",
  PRO: "51-100",
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

/** WhatsApp'tan satın alma / teklif mesajı (sitedeki iletişim numarasına). */
export function whatsappLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Öğrenci sayısına göre fiyatlar. whatsapp verilirse "WhatsApp'tan satın al" / "Teklif al" düğmeleri çıkar. */
export function TierCards({ plans, current, cta, whatsapp }: { plans: CenterPlanInfo[]; current?: CenterPlanName; cta?: string; whatsapp?: string | null }) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = current === plan.plan;
          const featured = !current && plan.highlight;
          const yearlySaving = plan.yearlyPriceTl ? plan.priceTl * 12 - plan.yearlyPriceTl : 0;
          const message = plan.quote
            ? `Merhaba, ${plan.name.toLocaleLowerCase("tr-TR")} olan kurumumuz için Pi Kampüs kurum paneli teklifi almak istiyoruz.`
            : `Merhaba, Pi Kampüs kurum paneli ${plan.name.toLocaleLowerCase("tr-TR")} paketini${plan.yearlyPriceTl ? ` yıllık (${formatMoney(plan.yearlyPriceTl * 100)} + KDV)` : ` aylık (${formatMoney(plan.priceTl * 100)} + KDV)`} almak istiyorum.`;
          return (
            <div key={plan.plan} className={cn("relative flex flex-col rounded-2xl border bg-white p-5", isCurrent || featured ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200")}>
              {isCurrent ? (
                <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">Mevcut kademe</span>
              ) : featured ? (
                <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-bold text-white">En çok tercih edilen</span>
              ) : null}
              <p className="font-bold text-slate-900">{plan.name}</p>
              {plan.upsell ? (
                <span className="mt-2 inline-block w-fit rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                  {plan.upsell.from} paketinden yalnızca {formatMoney(plan.upsell.diffTl * 100)} fazlasına {plan.upsell.ratio} kat öğrenci
                </span>
              ) : null}
              {plan.quote ? (
                <>
                  <p className="mt-1 text-2xl font-black text-slate-900">Teklif alın</p>
                  <p className="text-xs text-slate-500">Öğrenci sayınıza ve şube yapınıza göre fiyatlandırılır.</p>
                </>
              ) : plan.yearlyPriceTl ? (
                <>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {formatMoney(plan.yearlyPriceTl * 100)}
                    <span className="text-sm font-semibold text-slate-500"> / yıl</span>
                  </p>
                  <p className="text-xs text-slate-500">aylık {formatMoney(Math.round(plan.yearlyPriceTl / 12) * 100)}’ye denk gelir · peşin</p>
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
                  <p className="text-xs text-slate-500">yalnızca aylık ödeme</p>
                </>
              )}
              <div className="mt-auto flex flex-col gap-2 pt-4">
                {whatsapp && !isCurrent ? (
                  <a
                    href={whatsappLink(whatsapp, message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonClasses(featured ? "primary" : "outline", "sm", "w-full"), featured ? "" : "border-emerald-300 text-emerald-800 hover:bg-emerald-50")}
                  >
                    <MessageCircle className="size-4" aria-hidden /> {plan.quote ? "WhatsApp'tan teklif al" : "WhatsApp'tan satın al"}
                  </a>
                ) : null}
                {cta && !plan.quote ? (
                  <Link href={applyHref(plan.plan)} className="text-center text-sm font-semibold text-brand-700 hover:underline">
                    {cta}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">Fiyatlara KDV eklenir.</p>
    </div>
  );
}

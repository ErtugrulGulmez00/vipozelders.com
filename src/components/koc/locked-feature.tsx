import { Lock } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { COACH_FEATURES, parseCoachTiers, type CoachFeature } from "@/lib/pi-koc";
import { getSiteSettings } from "@/server/site";

/** Ücretsiz pakette kilitli özellik: gizlenmez, ne işe yaradığı ve hangi pakette açıldığı gösterilir. */
export async function LockedFeature({ feature, className, compact }: { feature: CoachFeature; className?: string; compact?: boolean }) {
  const tier = parseCoachTiers((await getSiteSettings()).piKocTiers)[0];
  const info = COACH_FEATURES[feature];
  const unlock = tier ? `${tier.students} öğrenci paketinde açılır · ayda ${tier.priceTl.toLocaleString("tr-TR")} ₺` : "Ücretli pakette açılır";
  return (
    <div className={cn("rounded-3xl border border-dashed border-ink-200 bg-slate-50/70 p-5", className)} data-locked={feature}>
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-500 ring-1 ring-slate-200">
          <Lock className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">{info.title}</p>
          {compact ? null : <p className="mt-1 text-sm text-slate-600">{info.text}</p>}
          <p className="mt-2 text-xs font-semibold text-brand-700">{unlock}</p>
        </div>
      </div>
      <Link href="/koc/abonelik" className={buttonClasses("outline", "sm", "mt-4 w-full sm:w-auto")}>
        Paketleri gör
      </Link>
    </div>
  );
}

/** Paket sayfaları: ücretsiz pakette olanlar ve ücretli pakette açılanlar. */
export function CoachPlanCompare({ freeStudents, freeMinutes, freeAi, freeHours }: { freeStudents: number; freeMinutes: number; freeAi: number; freeHours?: number }) {
  const free = [
    `${freeStudents} öğrenciye kadar, süresiz`,
    "Haftalık program, kaynak ve soru takibi",
    "Görüşme notları ve elle deneme girişi, net grafiği",
    "Haftalık veli raporu (elle gönderim, Pi Koç imzalı)",
    `Görüntülü görüşme: görüşme başına ${freeMinutes} dk${freeHours ? `, ayda toplam ${freeHours} saat` : ""}`,
    freeAi ? `Ayda ${freeAi} yapay zekâ taslağı` : null,
  ].filter((x): x is string => Boolean(x));
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-3xl border border-ink-100 p-5">
        <p className="font-bold text-ink-900">Ücretsiz pakette</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          {free.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-3xl border border-brand-200 bg-brand-50/40 p-5">
        <p className="font-bold text-ink-900">Ücretli pakette ek olarak</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          {Object.values(COACH_FEATURES).map((f) => (
            <li key={f.title}>{f.title}</li>
          ))}
          <li>Görüntülü görüşmede süre sınırı yok</li>
        </ul>
      </div>
    </div>
  );
}

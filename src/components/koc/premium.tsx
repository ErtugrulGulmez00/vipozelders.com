import { Award, Compass, Crown, FileUp, GraduationCap, Landmark, Map as MapIcon, PencilLine, Send, Sparkles, Star, Video, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { COACH_FEATURES, COACH_FREE_NAME, type CoachFeature, type CoachTier } from "@/lib/pi-koc";

// Pi Koç ücretli paketlerinin vitrini: paket simgeleri, ücretli özellikler ve yükseltme kartı (öğretmen özeti, Pi Koç menüsü).

const TIER_ICONS: Record<number, LucideIcon> = { 0: PencilLine, 5: Compass, 10: GraduationCap, 20: Award, 50: Landmark };
const TIER_TONES: Record<number, string> = {
  0: "from-slate-400 to-slate-500",
  5: "from-sky-400 to-indigo-500",
  10: "from-orange-400 to-rose-500",
  20: "from-amber-300 to-yellow-500",
  50: "from-fuchsia-500 to-violet-600",
};

/** Paketin simgesi (0 = ücretsiz paket). */
export function TierIcon({ students, className }: { students: number; className?: string }) {
  const Icon = TIER_ICONS[students] ?? Sparkles;
  return (
    <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm", TIER_TONES[students] ?? "from-brand-500 to-brand-700", className)}>
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

export const FEATURE_ICONS: Record<CoachFeature, LucideIcon> = { pdfImport: FileUp, topicAnalysis: MapIcon, ai: Sparkles, autoReport: Send, fees: Wallet, featured: Star };

/** Ücretli pakette açılan özellikler; görüntülü derste süre sınırının kalkması da eklenir. */
export function premiumFeatures() {
  return [
    ...(Object.keys(COACH_FEATURES) as CoachFeature[]).map((key) => ({ key, Icon: FEATURE_ICONS[key], ...COACH_FEATURES[key] })),
    { key: "video", Icon: Video, title: "Süre sınırsız görüntülü ders", text: "Görüşme başına süre sınırı kalkar; aylık süre paketinizdeki öğrenci sayısıyla büyür." },
  ];
}

/** Öğretmen özetindeki koyu, dikkat çeken yükseltme kartı (ücretsiz pakette). */
export function UpgradeShowcase({ next, used, limit, meetingMinutes, monthlyHours }: { next: CoachTier | null; used: number; limit: number; meetingMinutes: number; monthlyHours: number }) {
  const ratio = Math.min(1, used / Math.max(limit, 1));
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-ink-950 p-6 text-white shadow-lg sm:p-8">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-gold-400/20 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <TierIcon students={0} />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-300">Pi Koç paketiniz</p>
            <p className="text-xl font-extrabold">{COACH_FREE_NAME} · ücretsiz</p>
          </div>
        </div>
        <div className="min-w-48">
          <div className="flex justify-between text-xs text-ink-200">
            <span>Öğrenci</span>
            <span className="font-semibold text-white">
              {used} / {limit}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400" style={{ width: `${(ratio * 100).toFixed(0)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-ink-300">
            Görüntülü ders: görüşme başına {meetingMinutes} dk, ayda {monthlyHours} saat
          </p>
        </div>
      </div>

      <h2 className="relative mt-7 flex items-center gap-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        <Crown className="size-6 text-gold-400" aria-hidden /> Bir üst pakette sizi bekleyenler
      </h2>
      <ul className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {premiumFeatures().map(({ key, Icon, title, text }) => (
          <li key={key} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 transition hover:bg-white/10">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gold-400/15 text-gold-300">
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="mt-3 font-bold">{title}</p>
            <p className="mt-1 text-sm leading-snug text-ink-300">{text}</p>
          </li>
        ))}
      </ul>

      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 p-4 sm:p-5">
        {next ? (
          <div className="flex items-center gap-3">
            <TierIcon students={next.students} className="ring-2 ring-white/40" />
            <div>
              <p className="text-lg font-extrabold">{next.name}</p>
              <p className="text-sm text-white/85">
                {next.students} öğrenciye kadar · ayda {next.priceTl.toLocaleString("tr-TR")} ₺
              </p>
            </div>
          </div>
        ) : (
          <p className="font-bold">Ücretli paketlerle sınırları kaldırın</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href="/koc/abonelik" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold-400 px-5 font-bold text-ink-950 shadow hover:bg-gold-300">
            <Crown className="size-4" aria-hidden /> Paketleri gör
          </Link>
          <Link href="/koc" className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-5 font-semibold text-white ring-1 ring-white/30 hover:bg-white/25">
            Pi Koç&apos;a git
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Pi Koç menüsünün altındaki yükseltme kutusu (ücretsiz pakette). */
export function SidebarUpgrade({ next }: { next: CoachTier | null }) {
  return (
    <Link href="/koc/abonelik" className="group relative mx-3 mb-1 block overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-gold-500 p-4 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-6 -top-6 size-20 rounded-full bg-white/20 blur-xl" aria-hidden />
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white/90">
        <Crown className="size-3.5" aria-hidden /> Premium
      </p>
      <p className="mt-1 font-extrabold leading-tight">{next ? `${next.name} paketine geçin` : "Paketinizi yükseltin"}</p>
      <p className="mt-1 text-xs text-white/85">PDF aktarımı, konu haritası, otomatik veli raporu, sınırsız görüntülü ders</p>
      <span className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 group-hover:bg-gold-100">
        {next ? `Ayda ${next.priceTl.toLocaleString("tr-TR")} ₺ · Paketleri gör` : "Paketleri gör"}
      </span>
    </Link>
  );
}

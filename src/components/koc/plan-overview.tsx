import { ArrowRight, Check, Crown, FileUp, GraduationCap, School, Send, Sparkles, Target, Users, Video } from "lucide-react";
import { TierIcon } from "@/components/koc/premium";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { COACH_FREE_NAME, coachTierName, formatHours, type CoachPlan, type CoachTier } from "@/lib/pi-koc";

// Öğretmen özetinde Pi Koç kartı: solda kullanım hakları (gerçek sayılarla), sağda ücretli pakette neyin değiştiği.
// Tek ekrana sığacak kadar kısa; ayrıntılar Paketler sayfasında.

export type PlanUsage = {
  students: number;
  studentLimit: number;
  meetingUsedMinutes: number;
  meetingPoolMinutes: number;
  /** Görüşme başına dakika sınırı (ücretli pakette null) */
  meetingMaxMinutes: number | null;
  /** Bu ay kalan yapay zekâ hakkı (ücretli pakette null: günlük sınır) */
  aiLeft: number | null;
  aiPerMonth: number;
};

const UPGRADES = [
  { Icon: Video, text: "Süre sınırsız görüntülü ders" },
  { Icon: FileUp, text: "PDF'ten deneme aktarımı" },
  { Icon: Target, text: "Hedef okul takibi" },
  { Icon: Send, text: "Her hafta otomatik veli raporu" },
  { Icon: Sparkles, text: "Her gün yapay zekâ asistanı" },
  { Icon: School, text: "Öğrenciye tercih listesi" },
];

function Meter({ Icon, label, value, ratio, hint }: { Icon: typeof Users; label: string; value: string; ratio?: number; hint?: string }) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-ink-200">
          <Icon className="size-4 text-gold-300" aria-hidden /> {label}
        </span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      {ratio !== undefined ? (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={cn("h-full rounded-full", ratio >= 1 ? "bg-rose-400" : "bg-gradient-to-r from-brand-400 to-gold-400")} style={{ width: `${Math.max(3, Math.min(1, ratio) * 100).toFixed(0)}%` }} />
        </div>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-ink-300">{hint}</p> : null}
    </li>
  );
}

export function CoachPlanOverview({ plan, usage, next, kocHref, packagesHref, codeHref }: { plan: CoachPlan; usage: PlanUsage; next: CoachTier | null; kocHref: string; packagesHref: string; codeHref: string }) {
  const free = !plan.paid;
  const name = free ? COACH_FREE_NAME : coachTierName(plan.studentLimit);
  return (
    <section className="relative overflow-hidden rounded-3xl bg-ink-950 text-white shadow-lg">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-600/35 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 left-1/4 size-64 rounded-full bg-gold-400/15 blur-3xl" aria-hidden />
      <div className={cn("relative grid", free && "lg:grid-cols-[1.05fr_1fr]")}>
        {/* Kullanım hakları */}
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <TierIcon students={free ? 0 : plan.studentLimit} />
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-300">Pi Koç paketiniz</p>
                <p className="text-xl font-extrabold">
                  {name}
                  <span className="ml-2 align-middle text-sm font-semibold text-ink-300">
                    {free ? "ücretsiz" : plan.state === "promo" ? "deneme kodu" : plan.state === "trial" ? "deneme" : "ücretli"}
                  </span>
                </p>
              </div>
            </div>
            {plan.endsAt ? <span className="text-xs text-ink-300">{formatDate(plan.endsAt)} tarihine kadar</span> : null}
          </div>
          <ul className="mt-6 space-y-4">
            <Meter Icon={Users} label="Öğrenci" value={`${usage.students} / ${usage.studentLimit}`} ratio={usage.students / Math.max(usage.studentLimit, 1)} />
            <Meter
              Icon={Video}
              label="Bu ay görüntülü ders"
              value={`${formatHours(usage.meetingUsedMinutes)} / ${formatHours(usage.meetingPoolMinutes)}`}
              ratio={usage.meetingUsedMinutes / Math.max(usage.meetingPoolMinutes, 1)}
              hint={usage.meetingMaxMinutes ? `Görüşme başına en fazla ${usage.meetingMaxMinutes} dakika` : "Görüşme başına süre sınırı yok"}
            />
            <Meter
              Icon={Sparkles}
              label="Yapay zekâ önerisi"
              value={usage.aiLeft === null ? "her gün" : `bu ay ${usage.aiLeft} / ${usage.aiPerMonth} hak`}
              ratio={usage.aiLeft === null ? undefined : (usage.aiPerMonth - usage.aiLeft) / Math.max(usage.aiPerMonth, 1)}
            />
            <Meter Icon={Send} label="Otomatik veli raporu" value={free ? "ayda bir" : "her hafta"} />
            <Meter Icon={School} label="Tercih robotu" value={free ? "arama açık" : "liste ve çıktı açık"} />
          </ul>
          <a href={kocHref} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-gold-300 hover:text-gold-100">
            <GraduationCap className="size-4" aria-hidden /> Pi Koç&apos;a git <ArrowRight className="size-4" aria-hidden />
          </a>
        </div>

        {/* Ücretli pakette */}
        {free ? (
          <div className="border-t border-white/10 bg-white/[0.04] p-6 sm:p-7 lg:border-l lg:border-t-0">
            <p className="flex items-center gap-2 text-lg font-extrabold">
              <Crown className="size-5 text-gold-400" aria-hidden /> Ücretli pakete geçerseniz
            </p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {UPGRADES.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-sm text-ink-100">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 text-gold-300">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-300">
              <Check className="size-3.5 text-gold-300" aria-hidden /> ve logolu rapor, hatırlatmalar, hazır programlar, tahsilat takibi
            </p>
            {next ? (
              <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                <TierIcon students={next.students} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{next.name}</p>
                  <p className="text-xs text-ink-300">{next.students} öğrenciye kadar</p>
                </div>
                <p className="text-right">
                  <span className="text-xl font-black text-gold-300">{next.priceTl.toLocaleString("tr-TR")} ₺</span>
                  <span className="block text-xs text-ink-300">aylık</span>
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a href={packagesHref} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-gold-400 px-5 font-bold text-ink-950 shadow hover:bg-gold-300">
                <Crown className="size-4" aria-hidden /> Paketleri gör
              </a>
              <a href={codeHref} className="px-2 text-sm font-semibold text-white/85 hover:underline">
                Deneme kodunuz var mı?
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

import { Award, BellRing, Compass, Crown, FileUp, GraduationCap, Landmark, LayoutTemplate, Map as MapIcon, PencilLine, School, Send, Sparkles, Stamp, Star, Target, University, Video, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { COACH_FEATURES, type CoachFeature, type CoachTier } from "@/lib/pi-koc";

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

export const FEATURE_ICONS: Record<CoachFeature, LucideIcon> = {
  pdfImport: FileUp,
  topicAnalysis: MapIcon,
  ai: Sparkles,
  targetSchool: Target,
  lgsRobot: School,
  yksRobot: University,
  autoReport: Send,
  branding: Stamp,
  reminders: BellRing,
  templates: LayoutTemplate,
  fees: Wallet,
  featured: Star,
};

/** Ücretli pakette açılan özellikler; görüntülü derste süre sınırının kalkması da eklenir. */
export function premiumFeatures() {
  return [
    ...(Object.keys(COACH_FEATURES) as CoachFeature[]).map((key) => ({ key, Icon: FEATURE_ICONS[key], ...COACH_FEATURES[key] })),
    { key: "video", Icon: Video, title: "Süre sınırsız görüntülü ders", text: "Görüşme başına süre sınırı kalkar; aylık süre paketinizdeki öğrenci sayısıyla büyür." },
  ];
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
      <p className="mt-1 text-xs text-white/85">Daha fazla öğrenci, PDF&apos;ten deneme, hedef okul takibi, her hafta otomatik veli raporu ve yapay zekâ asistanı</p>
      <span className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 group-hover:bg-gold-100">
        {next ? `Ayda ${next.priceTl.toLocaleString("tr-TR")} ₺ · Paketleri gör` : "Paketleri gör"}
      </span>
    </Link>
  );
}

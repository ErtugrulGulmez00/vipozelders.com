import Link from "next/link";
import { cn } from "@/lib/cn";

export type SectionTab = { href: string; label: string; badge?: number };

/** Menüde tek başlık altında toplanan sayfaların üstündeki sekmeler (sunucu bileşeni; seçili sekme sayfadan gelir). */
export function SectionTabs({ tabs, active }: { tabs: SectionTab[]; active: string }) {
  return (
    <nav aria-label="Bölüm sekmeleri" className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 px-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium",
            tab.href === active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {tab.label}
          {tab.badge ? <span className="rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">{tab.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export const STUDENT_QUESTION_TABS: SectionTab[] = [
  { href: "/hesabim/sorularim", label: "Sorularım" },
  { href: "/hesabim/krediler", label: "Soru kredilerim" },
  { href: "/hesabim/abonelikler", label: "Aboneliklerim" },
];

export const STUDENT_LESSON_TABS: SectionTab[] = [
  { href: "/hesabim/derslerim", label: "Derslerim" },
  { href: "/hesabim/paketlerim", label: "Paketlerim" },
];

export const TEACHER_PROFILE_TABS: SectionTab[] = [
  { href: "/ogretmen-paneli/profil", label: "Profil bilgileri" },
  { href: "/ogretmen-paneli/dersler-ve-fiyatlar", label: "Dersler ve fiyatlar" },
  { href: "/ogretmen-paneli/belgeler", label: "Belgelerim" },
];

export function teacherLessonTabs(pending: number): SectionTab[] {
  return [
    { href: "/ogretmen-paneli/talepler", label: "Bekleyen talepler", badge: pending },
    { href: "/ogretmen-paneli/dersler", label: "Derslerim" },
  ];
}

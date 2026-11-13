import { BookOpenCheck, CalendarHeart, ChartLine, ClipboardCheck, ListChecks, ShieldCheck, Star, Video, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PiMark } from "@/components/site/pi-mark";
import { LoginTabs, type LoginGate } from "@/components/site/login-tabs";

// Üç giriş kapısının ortak görünümü: solda kapıya göre değişen tanıtım, sağda aynı kart (sekmeler + form).
// Böylece kapılar ayrı ürünler gibi değil, tek sitenin üç kapısı gibi görünür.

const GATES: Record<LoginGate, { eyebrow: string; title: ReactNode; points: { Icon: LucideIcon; text: string }[]; foot: string }> = {
  personal: {
    eyebrow: "Özel ders",
    title: (
      <>
        Doğru öğretmen, <span className="text-brand-400">doğru saatte</span>
      </>
    ),
    points: [
      { Icon: ShieldCheck, text: "Belgeleri incelenmiş, onaylı öğretmenler" },
      { Icon: Video, text: "Ücretsiz ders talebi; öğretmen kabul edince sizi arar" },
      { Icon: Star, text: "Program, ödev ve deneme takibi tek hesapta" },
    ],
    foot: "Veliler, öğrenciler ve öğretmenler buradan girer.",
  },
  center: {
    eyebrow: "Kurum paneli",
    title: (
      <>
        Kurumunuzun tamamı <span className="text-brand-400">tek panelde</span>
      </>
    ),
    points: [
      { Icon: ClipboardCheck, text: "Etüt planı, yoklama ve veliye anında bildirim" },
      { Icon: BookOpenCheck, text: "Deneme analizi, karne ve eksik konular" },
      { Icon: Wallet, text: "Taksit, tahsilat, makbuz ve gider takibi" },
    ],
    foot: "Kurum personeli, kurumun öğrencileri ve velileri buradan girer.",
  },
  koc: {
    eyebrow: "Pi Koç",
    title: (
      <>
        Öğrencinin gelişimi, <span className="text-brand-400">tek bakışta</span>
      </>
    ),
    points: [
      { Icon: ChartLine, text: "Net gelişimi, haftalık soru ve hedef grafikleri" },
      { Icon: ListChecks, text: "Öğrenci görevlerini işaretler, çözdüğü soruyu girer" },
      { Icon: CalendarHeart, text: "Görüşme notları, haftalık veli raporu, online görüşme" },
    ],
    foot: "Bireysel koçlar ve öğrencileri buradan girer.",
  },
};

export function GateLoginShell({
  gate,
  title,
  subtitle,
  brand,
  children,
  footer,
}: {
  gate: LoginGate;
  title: string;
  subtitle: string;
  /** Kurumun kendi giriş bağlantısında kurum logosu (varsa) */
  brand?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const g = GATES[gate];
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-brand-600/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 right-0 size-80 rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
        <Link href="/" className="relative inline-flex items-center gap-2.5 self-start">
          <span className="inline-flex size-10 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-900/40">
            <PiMark className="size-6" />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">Pi Kampüs</span>
        </Link>
        <div className="relative max-w-md">
          <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-200 ring-1 ring-white/15">{g.eyebrow}</p>
          <h2 className="mt-4 font-display text-4xl font-extrabold leading-[1.1] tracking-tight">{g.title}</h2>
          <ul className="mt-8 space-y-4">
            {g.points.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-ink-100">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  <Icon className="size-[18px] text-brand-300" aria-hidden />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-ink-300">
          {g.foot} <span className="text-ink-400">Tek hesap, üç kapı: hangi sekmeden girerseniz o tarafı görürsünüz.</span>
        </p>
      </aside>

      <main className="flex flex-col bg-[#f6f5fb]">
        <div className="flex items-center justify-between px-5 py-5 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="inline-flex size-9 -rotate-6 items-center justify-center rounded-xl bg-brand-600 text-white">
              <PiMark className="size-5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-ink-900">Pi Kampüs</span>
          </Link>
        </div>
        <div className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:pt-6">
          <div className="w-full max-w-md rounded-[2rem] border border-ink-100 bg-white p-6 shadow-xl shadow-ink-900/5 sm:p-8">
            <LoginTabs active={gate} />
            <div className="mb-6 flex items-center gap-3">
              {brand}
              <div>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
                <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
              </div>
            </div>
            {children}
            {footer ? <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

import { ArrowLeftRight, Bell, LogOut, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/actions/auth";
import { MobileNav, SideNav, type PanelNavItem } from "@/components/panel/nav-links";
import { PiMark } from "@/components/site/pi-mark";
import type { SideSwitch } from "@/lib/sides";
import { initials } from "@/lib/text";
import type { SessionUser } from "@/server/auth/current-user";

function KocBrand({ compact = false, home }: { compact?: boolean; home: string }) {
  return (
    <Link href={home} className="inline-flex items-center gap-2.5">
      <span className="inline-flex size-10 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-900/40">
        <PiMark className="size-6" />
      </span>
      <span className="leading-tight">
        <span className={compact ? "font-display text-lg font-extrabold tracking-tight text-ink-900" : "font-display text-xl font-extrabold tracking-tight text-white"}>Pi Koç</span>
        {compact ? null : <span className="block text-[11px] font-medium text-ink-300">Bireysel koçluk asistanı</span>}
      </span>
    </Link>
  );
}

/** Pi Koç iskeleti (koç paneli /koc ve öğrenci ekranı /kocum): koyu menü, bildirim zili; koçta öğrenci arama ve sınır göstergesi. */
export function KocShell({
  user,
  nav,
  unread,
  usage,
  banner,
  switchLinks = [],
  mode = "coach",
  roleLabel,
  children,
}: {
  user: SessionUser;
  nav: PanelNavItem[];
  unread: number;
  /** Koçun öğrenci sınırı (öğrenci ekranında yok) */
  usage?: { active: number; limit: number };
  banner?: ReactNode;
  /** Özel ders öğretmeni olan koçta özel ders paneline geçiş */
  switchLinks?: SideSwitch[];
  /** coach: koç paneli; student: öğrenci/veli ekranı */
  mode?: "coach" | "student";
  /** Kartta adın altındaki görev (ör. Öğrenci, Veli) */
  roleLabel?: string;
  children: ReactNode;
}) {
  const coach = mode === "coach";
  const home = coach ? "/koc" : "/kocum";
  const ratio = usage ? Math.min(1, usage.active / Math.max(usage.limit, 1)) : 0;
  return (
    <div className="min-h-dvh bg-[#f6f5fb] lg:grid lg:grid-cols-[264px_1fr] print:block print:bg-white">
      <aside className="relative hidden overflow-hidden bg-ink-950 lg:flex lg:flex-col print:hidden">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand-600/25 blur-3xl" aria-hidden />
        <div className="relative px-5 py-6">
          <KocBrand home={home} />
        </div>
        <div className="relative flex-1 overflow-y-auto px-3">
          <SideNav items={nav} />
        </div>
        <div className="relative m-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <Link href={`${home}/hesap`} className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{initials(user)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {user.firstName} {user.lastName}
              </span>
              <span className="block text-xs text-ink-300">{roleLabel ?? (coach ? "Koç" : "Öğrenci")}</span>
            </span>
          </Link>
          {usage ? (
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-ink-300">
              <span>Öğrenci</span>
              <span>
                {usage.active}/{usage.limit}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${(ratio * 100).toFixed(0)}%` }} />
            </div>
          </div>
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-16 print:hidden items-center justify-between gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur sm:px-6">
          <div className="lg:hidden">
            <KocBrand compact home={home} />
          </div>
          {coach ? (
          <form action="/koc/ogrenciler" method="get" role="search" className="relative hidden max-w-sm flex-1 lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input name="q" type="search" placeholder="Öğrenci ara" aria-label="Öğrenci ara" className="h-10 w-full rounded-xl border border-ink-100 bg-[#f6f5fb] pl-9 pr-3 text-sm focus:border-brand-400 focus:bg-white focus:outline-none" />
          </form>
          ) : (
            <span className="hidden lg:block" />
          )}
          <div className="flex items-center gap-1">
            {switchLinks.map((link) => (
              <Link key={link.href} href={link.href} aria-label={link.label} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                <ArrowLeftRight className="size-4" aria-hidden /> <span className="sm:hidden">{link.short}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            ))}
            <Link href={`${home}/bildirimler`} className="relative inline-flex size-10 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" aria-label={unread ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}>
              <Bell className="size-5" aria-hidden />
              {unread ? <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Çıkış</span>
              </button>
            </form>
          </div>
        </header>
        <div className="px-4 print:hidden">
          <MobileNav items={nav} />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
          {banner}
          {children}
        </main>
      </div>
    </div>
  );
}

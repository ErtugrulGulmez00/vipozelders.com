import { ArrowLeftRight, ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/site/logo";
import { ROLE_LABEL } from "@/lib/labels";
import type { SideSwitch } from "@/lib/sides";
import { initials } from "@/lib/text";
import type { SessionUser } from "@/server/auth/current-user";
import { MobileNav, SideNav, type PanelNavItem } from "./nav-links";

/** Admin, öğretmen, öğrenci ve kurum panellerinin ortak iskeleti. */
export function PanelShell({
  user,
  title,
  nav,
  children,
  roleLabel,
  banner,
  headerSlot,
  switchLinks = [],
  hideSiteLink = false,
}: {
  user: SessionUser;
  title: string;
  nav: PanelNavItem[];
  children: ReactNode;
  /** Kullanıcının rol adı yerine gösterilecek metin (ör. kurumdaki görevi) */
  roleLabel?: string;
  /** Sayfa içeriğinin üstünde gösterilen uyarı (ör. abonelik bitiyor) */
  banner?: ReactNode;
  /** Üst çubukta (ör. öğrenci arama) */
  headerSlot?: ReactNode;
  /** Kurum ve özel ders tarafı olan kişide diğer tarafa geçiş */
  switchLinks?: SideSwitch[];
  /** Kurum tarafında vitrin (özel ders) bağlantısı gösterilmez */
  hideSiteLink?: boolean;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden bg-ink-900 lg:flex lg:flex-col">
        <div className="px-5 py-5">
          <Logo light />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-brand-300">{title}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <SideNav items={nav} />
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials(user)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-400">{roleLabel ?? ROLE_LABEL[user.role]}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</span>
          </div>
          <div className="hidden min-w-0 flex-1 lg:block">{headerSlot}</div>
          <div className="flex items-center gap-1">
            {switchLinks.map((link) => (
              // Üst çubukta her ekranda görünür; telefonda kısa ad
              <Link key={link.href} href={link.href} aria-label={link.label} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                <ArrowLeftRight className="size-4" aria-hidden /> <span className="sm:hidden">{link.short}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            ))}
            {hideSiteLink ? null : (
              <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                <ExternalLink className="size-4" aria-hidden /> <span className="hidden sm:inline">Siteye git</span>
              </Link>
            )}
            <form action={logoutAction}>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">Çıkış</span>
              </button>
            </form>
          </div>
        </header>
        <div className="px-4">
          <MobileNav items={nav} />
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          {banner}
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** also: bu başlık altında toplanan diğer sayfalar (sekmeli bölümler); oradayken de başlık seçili görünür. */
/** group: menüde bu maddenin üstünde gösterilen küçük başlık (aynı başlıktaki ardışık maddeler bir arada durur). */
/** locked: ücretli pakette açılan bölüm (kilit simgesi); accent: öne çıkan madde (ör. Paketler); tag: sağdaki kısa etiket. */
export type PanelNavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean; also?: string[]; group?: string; locked?: boolean; accent?: boolean; tag?: string };

function isActive(pathname: string, item: PanelNavItem) {
  const match = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  if (item.exact) return pathname === item.href;
  return match(item.href) || Boolean(item.also?.some(match));
}

export function SideNav({ items }: { items: PanelNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="Panel menüsü">
      {items.map((item, index) => (
        <div key={item.href}>
          {item.group && item.group !== items[index - 1]?.group ? (
            <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{item.group}</p>
          ) : null}
        <Link
          href={item.href}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, item) ? "bg-brand-600 text-white" : item.accent ? "text-gold-300 hover:bg-white/10 hover:text-gold-100" : "text-slate-300 hover:bg-white/10 hover:text-white",
          )}
        >
          <span className="size-4 shrink-0 [&>svg]:size-4">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge ? <span className="rounded-full bg-gold-400 px-1.5 text-xs font-bold text-ink-900">{item.badge}</span> : null}
          {item.tag ? <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-ink-900">{item.tag}</span> : null}
          {item.locked ? <Lock className="size-3.5 text-gold-400" aria-label="Ücretli pakette" /> : null}
        </Link>
        </div>
      ))}
    </nav>
  );
}

export function MobileNav({ items }: { items: PanelNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden" aria-label="Panel menüsü">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
            isActive(pathname, item) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700",
          )}
        >
          {item.label}
          {item.badge ? <span className="rounded-full bg-gold-400 px-1.5 text-[10px] text-ink-900">{item.badge}</span> : null}
          {item.locked ? <Lock className="size-3 text-gold-600" aria-label="Ücretli pakette" /> : null}
        </Link>
      ))}
    </nav>
  );
}

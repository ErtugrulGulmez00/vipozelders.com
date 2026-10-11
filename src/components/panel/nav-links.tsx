"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type PanelNavItem = { href: string; label: string; icon: ReactNode; badge?: number; exact?: boolean };

function isActive(pathname: string, item: PanelNavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function SideNav({ items }: { items: PanelNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="Panel menüsü">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive(pathname, item) ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
          )}
        >
          <span className="size-4 shrink-0 [&>svg]:size-4">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge ? <span className="rounded-full bg-gold-400 px-1.5 text-xs font-bold text-brand-950">{item.badge}</span> : null}
        </Link>
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
          {item.badge ? <span className="rounded-full bg-gold-400 px-1.5 text-[10px] text-brand-950">{item.badge}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

import { Menu } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getSiteSettings } from "@/server/site";
import { Logo } from "./logo";
import { UserMenu, UserMenuFallback } from "./user-menu";

const NAV = [
  { href: "/ogretmenler", label: "Öğretmen bul" },
  { href: "/ogretmenler?service=soru-cozum", label: "Soru çözüm" },
  { href: "/ogretmenler?service=kocluk", label: "Koçluk" },
  { href: "/sayfa/nasil-calisir", label: "Nasıl çalışır?" },
];

export async function SiteHeader() {
  const settings = await getSiteSettings();
  return (
    <>
      {settings.announcement ? (
        <div className="bg-brand-900 px-4 py-2 text-center text-sm font-medium text-gold-100">{settings.announcement}</div>
      ) : null}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={<UserMenuFallback />}>
              <UserMenu />
            </Suspense>
            <details className="relative md:hidden">
              <summary className="inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 [&::-webkit-details-marker]:hidden" aria-label="Menü">
                <Menu className="size-5" aria-hidden />
              </summary>
              <nav className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" aria-label="Mobil menü">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>
    </>
  );
}

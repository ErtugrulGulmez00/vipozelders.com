import { Menu } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { getSiteSettings } from "@/server/site";
import { Logo } from "./logo";
import { UserMenu, UserMenuFallback } from "./user-menu";

const NAV = [
  { href: "/ogretmenler", label: "Öğretmen bul" },
  { href: "/soru-sor", label: "Soru sor" },
  { href: "/grup-dersleri", label: "Grup dersleri" },
  { href: "/ogretmenler?service=kocluk", label: "Koçluk" },
  { href: "/nasil-calisir", label: "Nasıl çalışır?" },
  { href: "/kurumlar-icin", label: "Kurumlar için" },
];

export async function SiteHeader() {
  const settings = await getSiteSettings();
  return (
    <>
      {settings.announcement ? (
        <div className="pk-site-chrome bg-ink-900 px-4 py-2 text-center text-sm font-medium text-gold-100">{settings.announcement}</div>
      ) : null}
      <header className="pk-site-chrome sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden items-center gap-0.5 rounded-full bg-ink-50 p-1 lg:flex" aria-label="Ana menü">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:bg-white hover:text-ink-900 hover:shadow-xs">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Suspense fallback={<UserMenuFallback />}>
              <UserMenu />
            </Suspense>
            <details data-dropdown className="relative lg:hidden">
              <summary className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full text-ink-900 hover:bg-ink-50 [&::-webkit-details-marker]:hidden" aria-label="Menü">
                <Menu className="size-5" aria-hidden />
              </summary>
              <nav className="absolute right-0 z-40 mt-2 w-60 rounded-2xl border border-ink-100 bg-white p-2 shadow-lg" aria-label="Mobil menü">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
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

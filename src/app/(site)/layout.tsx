import { Wrench } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CookieNotice } from "@/components/site/cookie-notice";
import { PageViewTracker } from "@/components/site/page-view-tracker";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSiteSettings } from "@/server/site";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      {settings.maintenanceMode ? (
        // Bakım modunda ziyaretçiler proxy'de bakım sayfasına alınır; siteyi yalnızca yöneticiler görür.
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
          <Wrench className="size-4" aria-hidden /> Site bakım modunda: ziyaretçiler bakım sayfasını görüyor.
          <Link href="/yonetim/ayarlar" className="underline">
            Bakım modunu kapat
          </Link>
        </div>
      ) : null}
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <CookieNotice />
      {/* Adres bilgisi istemcide okunur; sayfanın önceden hazırlanmasını bekletmesin */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </div>
  );
}

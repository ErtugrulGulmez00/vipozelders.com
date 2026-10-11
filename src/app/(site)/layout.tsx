import { Wrench } from "lucide-react";
import { CookieNotice } from "@/components/site/cookie-notice";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSiteSettings } from "@/server/site";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        {settings.maintenanceMode ? (
          <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
            <Wrench className="mb-4 size-10 text-brand-500" aria-hidden />
            <h1 className="text-2xl font-bold text-slate-900">Bakımdayız</h1>
            <p className="mt-2 text-slate-600">{settings.maintenanceMessage}</p>
          </div>
        ) : (
          children
        )}
      </main>
      <SiteFooter />
      <CookieNotice />
    </div>
  );
}

import { Lock, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCatalog, getFooterPages, getSiteSettings } from "@/server/site";
import { CardLogos } from "./card-logos";
import { Logo } from "./logo";

export async function SiteFooter() {
  const [settings, pages, catalog] = await Promise.all([getSiteSettings(), getFooterPages(), getCatalog()]);
  return (
    <footer className="pk-site-chrome mt-20 bg-ink-900 text-ink-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm leading-relaxed text-ink-300">{settings.siteTagline}</p>
          <address className="space-y-1.5 text-sm not-italic">
            {settings.companyName ? <p className="font-medium text-slate-200">{settings.companyName}</p> : null}
            {/* Marka ile yasal kişiyi bağlar (Meta işletme doğrulaması ve WhatsApp görünen ad onayı bunu arar) */}
            {settings.companyName && settings.companyName !== settings.siteName ? (
              <p className="text-xs text-slate-400">
                {settings.siteName} markası {settings.companyName} tarafından işletilmektedir.
              </p>
            ) : null}
            {settings.companyAddress ? (
              <p className="flex gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> <span className="whitespace-pre-line">{settings.companyAddress}</span>
              </p>
            ) : null}
            {settings.contactPhone ? (
              <p className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`tel:${settings.contactPhone.replace(/[^\d+]/g, "")}`} className="hover:text-white">{settings.contactPhone}</a>
              </p>
            ) : null}
            {settings.contactEmail ? (
              <p className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-white">{settings.contactEmail}</a>
              </p>
            ) : null}
            {settings.companyTaxInfo ? <p className="text-xs text-slate-400">{settings.companyTaxInfo}</p> : null}
          </address>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Kademeler</h2>
          <ul className="space-y-2 text-sm">
            {catalog.levels.map((level) => (
              <li key={level.id}>
                <Link href={`/ozel-ders/${level.slug}`} className="hover:text-white">
                  {level.name} özel ders
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Hizmetler</h2>
          <ul className="space-y-2 text-sm">
            {catalog.services.map((service) => (
              <li key={service.id}>
                <Link href={`/ogretmenler?service=${service.slug}`} className="hover:text-white">
                  {service.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/grup-dersleri" className="hover:text-white">
                Grup dersleri (sanal dershane)
              </Link>
            </li>
            <li>
              <Link href="/ogretmen-ol" className="hover:text-white">
                Öğretmen olarak katılın
              </Link>
            </li>
            <li>
              <Link href="/kurumlar-icin" className="hover:text-white">
                Etüt merkezi / dershane paneli
              </Link>
            </li>
            <li>
              <Link href="/kurum-giris" className="hover:text-white">
                Kurum paneli girişi
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-white">Kurumsal</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/rehber" className="hover:text-white">
                Rehber (blog)
              </Link>
            </li>
            {pages.map((page) => (
              <li key={page.slug}>
                <Link href={`/sayfa/${page.slug}`} className="hover:text-white">
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {settings.companyName || settings.siteName}. Tüm hakları saklıdır.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1">
              <Lock className="size-3.5" aria-hidden /> 256-bit SSL
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1">
              <ShieldCheck className="size-3.5" aria-hidden /> 3D Secure
            </span>
            <CardLogos />
          </div>
        </div>
      </div>
    </footer>
  );
}

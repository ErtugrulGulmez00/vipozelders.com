import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import { getSiteSettings } from "@/server/site";
import "./globals.css";

// Gövde: DM Sans; başlıklar: Bricolage Grotesque (ikisi de Türkçe karakterli latin-ext ile)
const sans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  display: "swap",
});
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: { default: `${settings.siteName} · Özel ders, soru çözüm ve koçluk`, template: `%s · ${settings.siteName}` },
    description: settings.siteTagline,
    metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
    // WhatsApp, Instagram vb. bağlantı önizlemesi (görsel: app/opengraph-image.tsx)
    openGraph: { type: "website", locale: "tr_TR", siteName: settings.siteName, title: `${settings.siteName} · Özel ders, soru çözüm ve koçluk`, description: settings.siteTagline },
    twitter: { card: "summary_large_image" },
    // iPhone: "Ana Ekrana Ekle" ile tam ekran açılır (simge: app/apple-icon.png)
    appleWebApp: { capable: true, title: settings.siteName, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#d63f1c" };

// Pi Kampüs mobil uygulaması WebView'ı user-agent'a "PiKampusApp" ekler; sayfa boyanmadan önce işaretlenir.
const APP_MODE_SCRIPT = "if(/PiKampusApp/.test(navigator.userAgent))document.documentElement.classList.add('pk-app')";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getSiteSettings } from "@/server/site";
import "./globals.css";

const font = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
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
  };
}

// Pi Kampüs mobil uygulaması WebView'ı user-agent'a "PiKampusApp" ekler; sayfa boyanmadan önce işaretlenir.
const APP_MODE_SCRIPT = "if(/PiKampusApp/.test(navigator.userAgent))document.documentElement.classList.add('pk-app')";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_SCRIPT }} />
      </head>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}

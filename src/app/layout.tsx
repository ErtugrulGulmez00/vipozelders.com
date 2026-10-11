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
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" className={font.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}

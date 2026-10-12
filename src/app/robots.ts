import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Paneller, ödeme ve hesap sayfaları arama motorlarına kapalı.
      disallow: ["/yonetim", "/ogretmen-paneli", "/hesabim", "/kurum/", "/kurum-davet/", "/kurum-erisim", "/ders/", "/rezervasyon", "/odeme/", "/api/", "/giris", "/kayit", "/sifre"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

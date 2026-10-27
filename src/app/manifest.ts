import type { MetadataRoute } from "next";

// Siteyi telefonda "Ana ekrana ekle" ile uygulama gibi açmak için (PWA). Simgeler public/icons altında.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pi Kampüs",
    short_name: "Pi Kampüs",
    description: "Özel ders, soru çözüm ve koçluk; etüt merkezi ve dershaneler için kurum paneli.",
    lang: "tr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#d63f1c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

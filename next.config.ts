import type { NextConfig } from "next";

// Server Action'larda tarayıcının Origin başlığı sunucunun gördüğü adresle karşılaştırılır.
// Tünel ya da kendi Host başlığını ileten bir proxy arkasında APP_URL'deki adres de kabul edilir.
function allowedOrigins(): string[] {
  const hosts = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  try {
    if (process.env.APP_URL) hosts.push(new URL(process.env.APP_URL).host);
  } catch {
    // Geçersiz APP_URL: yalnızca aynı adres kabul edilir.
  }
  return hosts;
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  // "X-Powered-By: Next.js" başlığı gönderilmez.
  poweredByHeader: false,
  partialPrefetching: true,
  // iyzipay modüllerini dosya sisteminden dinamik yüklediği için paketlenmeden çalıştırılmalı.
  serverExternalPackages: ["iyzipay", "pg", "nodemailer", "exceljs", "unpdf"],
  // Eski "Nasıl çalışır?" yazısı (alt bilgi bağlantısı) yeni rehbere gider
  async redirects() {
    return [
      { source: "/sayfa/nasil-calisir", destination: "/nasil-calisir/ozel-ders", permanent: true },
      // Kaldırılan ücretli soru çözüm ve Dershane rehberi adresleri
      { source: "/nasil-calisir/dershane", destination: "/nasil-calisir/etut-merkezi", permanent: true },
      { source: "/soru-sor", destination: "/ozel-ders", permanent: true },
      { source: "/abonelik/:path*", destination: "/ogretmenler", permanent: true },
      { source: "/hesabim/sorularim/:path*", destination: "/hesabim", permanent: true },
      { source: "/hesabim/krediler", destination: "/hesabim", permanent: true },
      { source: "/hesabim/abonelikler/:path*", destination: "/hesabim", permanent: true },
      { source: "/ogretmen-paneli/soru-havuzu/:path*", destination: "/ogretmen-paneli/soru-cozum", permanent: true },
      { source: "/ogretmen-paneli/soru-aboneligi", destination: "/ogretmen-paneli/soru-cozum", permanent: true },
      { source: "/yonetim/soru-havuzu", destination: "/yonetim", permanent: true },
    ];
  },
  experimental: {
    serverActions: {
      // Fotoğraf, belge ve kurumun soru çözüm videosu yüklemeleri (dosya sınırları uygulamada: 5-8 MB, video 25 MB).
      bodySizeLimit: "30mb",
      allowedOrigins: allowedOrigins(),
    },
    // proxy.ts çalıştığı için istek gövdesi bellekte tutulur; varsayılan 10 MB'ı aşan yükleme yarıda kesilip
    // "Unexpected end of form" hatası veriyordu. Server Action sınırıyla aynı olmalı.
    proxyClientMaxBodySize: "30mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

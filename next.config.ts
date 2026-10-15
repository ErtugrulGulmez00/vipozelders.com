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
  serverExternalPackages: ["iyzipay", "pg", "nodemailer", "exceljs"],
  experimental: {
    serverActions: {
      // Fotoğraf, belge ve soru çözüm videosu yüklemeleri (dosya sınırları uygulamada: 5-8 MB, video 25 MB).
      bodySizeLimit: "30mb",
      allowedOrigins: allowedOrigins(),
    },
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

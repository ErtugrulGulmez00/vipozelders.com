import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // iyzipay modüllerini dosya sisteminden dinamik yüklediği için paketlenmeden çalıştırılmalı.
  serverExternalPackages: ["iyzipay", "pg", "nodemailer"],
  experimental: {
    serverActions: {
      // Profil fotoğrafı ve belge yüklemeleri için (dosya sınırı uygulamada 5 MB).
      bodySizeLimit: "6mb",
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

import { defineConfig } from "@playwright/test";

// Uçtan uca testler çalışan geliştirme sunucusuna karşı koşar (npm run db + npm run dev).
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/giris",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

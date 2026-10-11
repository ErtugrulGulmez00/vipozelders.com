import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/vipozelders_test?schema=public",
      APP_SECRET: "test-secret-test-secret-test-secret-1234",
      PAYMENT_PROVIDER: "mock",
      LIVEKIT_URL: "",
    },
    // Veritabanı testleri aynı test veritabanını paylaştığı için sırayla çalışır.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});

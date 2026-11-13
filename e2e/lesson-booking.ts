import pg from "pg";

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";

/**
 * Vitrinden randevu ve ödeme ayarı (2026-11-12'den beri canlıda kapalı; veli ders talebi gönderir). Randevu, paket ve
 * grup dersi akışlarının testleri kodu korunduğu için ayarı açıp çalışır, bitince kapatır.
 */
export async function setLessonBooking(on: boolean) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const value = on ? "true" : "false";
    await client.query(`INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ('lessonBookingEnabled', $1::jsonb, now()) ON CONFLICT ("key") DO UPDATE SET "value" = $1::jsonb, "updatedAt" = now()`, [value]);
  } finally {
    await client.end();
  }
}

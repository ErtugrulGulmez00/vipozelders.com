import { execSync } from "node:child_process";
import pg from "pg";

export const TEST_DATABASE = "vipozelders_test";
const ADMIN_URL = process.env.TEST_DB_ADMIN_URL ?? "postgresql://postgres:postgres@localhost:5433/postgres";

/** Her test çalıştırmasında temiz bir test veritabanı oluşturup migration'ları uygular. */
export default async function setup() {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    throw new Error("Test veritabanına bağlanılamadı. Önce ayrı bir terminalde `npm run db` çalıştırın.");
  }
  await client.query(`DROP DATABASE IF EXISTS "${TEST_DATABASE}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${TEST_DATABASE}"`);
  await client.query(`ALTER DATABASE "${TEST_DATABASE}" SET timezone TO 'UTC'`);
  await client.end();

  const testUrl = ADMIN_URL.replace(/\/postgres$/, `/${TEST_DATABASE}`);
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: testUrl } });

  // Randevu, paket ve grup dersi akışlarının testleri: vitrinden satış açıkmış gibi (canlıda varsayılan kapalı)
  const db = new pg.Client({ connectionString: testUrl });
  await db.connect();
  // Grup dersi, paket ve davet de 2026-11'den beri varsayılan kapalı; eski akışların testleri için açılır
  for (const key of ["lessonBookingEnabled", "groupsEnabled", "packagesEnabled", "referralEnabled"]) {
    await db.query(`INSERT INTO "SiteSetting" ("key", "value", "updatedAt") VALUES ($1, 'true'::jsonb, now()) ON CONFLICT ("key") DO UPDATE SET "value" = 'true'::jsonb`, [key]);
  }
  await db.end();
}

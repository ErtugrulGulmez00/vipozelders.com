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

  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: ADMIN_URL.replace(/\/postgres$/, `/${TEST_DATABASE}`) },
  });
}

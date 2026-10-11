/**
 * Geliştirme veritabanı: proje içinde (.data/postgres) çalışan gömülü PostgreSQL.
 * Sisteme kurulum gerektirmez. `npm run db` ile başlar, Ctrl+C ile durur.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".data/postgres");
const port = Number(process.env.DB_PORT ?? 5433);
const databaseName = process.env.DB_NAME ?? "vipozelders";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (message) => {
    const text = String(message);
    if (/ERROR|FATAL|PANIC/.test(text)) console.error(text.trim());
  },
});

async function main() {
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("PostgreSQL veri klasörü oluşturuluyor...");
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
  if (existing.rowCount === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`);
    console.log(`"${databaseName}" veritabanı oluşturuldu.`);
  }
  // Uygulama tüm zamanları UTC saklar; oturum saat dilimi de UTC olmalı.
  await client.query(`ALTER DATABASE "${databaseName}" SET timezone TO 'UTC'`);
  await client.end();

  console.log(`PostgreSQL hazır: postgresql://postgres:postgres@localhost:${port}/${databaseName}`);
  console.log("Durdurmak için Ctrl+C.");

  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch(async (error) => {
  console.error("PostgreSQL başlatılamadı:", error);
  await pg.stop().catch(() => {});
  process.exit(1);
});

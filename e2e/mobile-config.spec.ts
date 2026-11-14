import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * Pi Kampüs uygulamasının açılış ayarları (GET /ayarlar) ve Pi Koç sayfalarını uygulama içinde oturum açık açan
 * tek kullanımlık web girişi (POST /web-oturum { path: "/koc/abonelik" }).
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API = `${BASE}/api/mobil/v1`;
const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";

async function sql(text: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

test.afterAll(async () => {
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-config'`);
});

test("mobil: açılış ayarları sürüm, Pi Koç paketleri ve site sayfalarını verir", async ({ request }) => {
  const res = await request.get(`${API}/ayarlar`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.app.minVersion).toMatch(/^\d+\.\d+\.\d+$/);
  expect(body.app.latestVersion).toMatch(/^\d+\.\d+\.\d+$/);
  expect(body.piKoc.free.students).toBeGreaterThan(0);
  expect(body.piKoc.tiers.length).toBeGreaterThan(0);
  expect(body.piKoc.tiers[0]).toMatchObject({ students: expect.any(Number), priceTl: expect.any(Number), name: expect.any(String) });
  const keys = body.pages.map((p: { key: string }) => p.key);
  expect(keys).toEqual(expect.arrayContaining(["paketler", "tercih-lgs", "kvkk"]));
  const paketler = body.pages.find((p: { key: string }) => p.key === "paketler");
  expect(paketler).toMatchObject({ path: "/koc/abonelik", auth: true });
  // Herkese açık sayfalar gerçekten açılıyor
  const kvkk = body.pages.find((p: { key: string }) => p.key === "kvkk");
  expect((await request.get(`${BASE}${kvkk.path}`)).status()).toBe(200);
});

test("mobil: koç Paketler sayfasını tek kullanımlık bağlantıyla oturum açık açar; koç olmayan açamaz", async ({ request }) => {
  const login = async (identifier: string, password: string) => {
    const r = await request.post(`${API}/oturum`, { data: { identifier, password, deviceName: "e2e-config" } });
    expect(r.status()).toBe(200);
    return (await r.json()).token as string;
  };
  // Her öğretmende Pi Koç ücretsiz paketi açık
  const teacher = await login("ayse.yilmaz", "Ogretmen123");
  const link = await request.post(`${API}/web-oturum`, { headers: { Authorization: `Bearer ${teacher}` }, data: { path: "/koc/abonelik" } });
  expect(link.status()).toBe(200);
  const { url } = await link.json();
  expect(url).toContain("/api/mobil/v1/web-giris?");
  // Geçersiz Pi Koç adresi reddedilir
  const bad = await request.post(`${API}/web-oturum`, { headers: { Authorization: `Bearer ${teacher}` }, data: { path: "/koc/../yonetim" } });
  expect(bad.status()).toBe(422);
  // Koç üyeliği olmayan veli
  const parent = await login("veli@demo.vipozelders.local", "Veli12345");
  const denied = await request.post(`${API}/web-oturum`, { headers: { Authorization: `Bearer ${parent}` }, data: { path: "/koc/abonelik" } });
  expect([403, 422]).toContain(denied.status());
});

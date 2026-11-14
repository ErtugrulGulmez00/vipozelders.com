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

test("mobil: öğretmen ders taleplerini görür, kabul edince telefon açılır; veli Hesabım'ı uygulama içinde açar", async ({ request }) => {
  const login = async (identifier: string, password: string) => {
    const r = await request.post(`${API}/oturum`, { data: { identifier, password, deviceName: "e2e-config" } });
    expect(r.status()).toBe(200);
    return (await r.json()).token as string;
  };
  const [teacher] = await sql(`SELECT id FROM "User" WHERE username = 'ayse.yilmaz'`);
  const inquiryId = `e2e_inq_${Date.now()}`;
  await sql(
    `INSERT INTO "TeacherInquiry" (id, "teacherId", name, phone, "studentName", "gradeName", "lessonName", mode, "updatedAt")
     VALUES ($1, $2, 'E2e Veli', '05321112233', 'E2e Öğrenci', '8. sınıf', 'Ortaokul · Matematik', 'online', now())`,
    [inquiryId, teacher.id],
  );
  try {
    const token = await login("ayse.yilmaz", "Ogretmen123");
    const auth = { Authorization: `Bearer ${token}` };
    const list = await (await request.get(`${API}/ogretmen/ders-talepleri`, { headers: auth })).json();
    const item = list.items.find((q: { id: string }) => q.id === inquiryId);
    expect(item).toMatchObject({ status: "PENDING", phone: null, studentName: "E2e Öğrenci", modeLabel: "Online" });
    expect(list.pending).toBeGreaterThan(0);

    const accept = await request.post(`${API}/ogretmen/ders-talepleri/${inquiryId}`, { headers: auth, data: { action: "accept" } });
    expect(accept.status()).toBe(200);
    expect((await accept.json()).message).toContain("Talebi kabul ettiniz");
    const after = (await (await request.get(`${API}/ogretmen/ders-talepleri`, { headers: auth })).json()).items.find((q: { id: string }) => q.id === inquiryId);
    expect(after).toMatchObject({ status: "ACCEPTED", phone: "05321112233", whatsapp: "905321112233" });
    // Tekrar yanıt verilemez
    expect((await request.post(`${API}/ogretmen/ders-talepleri/${inquiryId}`, { headers: auth, data: { action: "decline" } })).status()).toBe(422);

    // Öğretmen panel sayfaları uygulama içinde açılır
    expect((await request.post(`${API}/web-oturum`, { headers: auth, data: { path: "/ogretmen-paneli/mesajlar" } })).status()).toBe(200);
    // Veli: Hesabım ve kurum portalı
    const parent = await login("veli@demo.vipozelders.local", "Veli12345");
    expect((await request.post(`${API}/web-oturum`, { headers: { Authorization: `Bearer ${parent}` }, data: { path: "/hesabim" } })).status()).toBe(200);
    expect((await request.post(`${API}/web-oturum`, { headers: { Authorization: `Bearer ${parent}` }, data: { path: "/hesabim/kurum" } })).status()).toBe(200);
    // Veli öğretmen paneli açamaz
    expect((await request.post(`${API}/web-oturum`, { headers: { Authorization: `Bearer ${parent}` }, data: { path: "/ogretmen-paneli" } })).status()).toBe(403);
  } finally {
    const [row] = await sql(`SELECT "centerStudentId" FROM "TeacherInquiry" WHERE id = $1`, [inquiryId]);
    await sql(`DELETE FROM "TeacherInquiry" WHERE id = $1`, [inquiryId]);
    if (row?.centerStudentId) await sql(`DELETE FROM "CenterStudent" WHERE id = $1`, [row.centerStudentId]);
    await sql(`DELETE FROM "Notification" WHERE type LIKE 'inquiry.%' AND "createdAt" > now() - interval '1 hour'`);
  }
});

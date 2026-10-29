import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";

/**
 * Mobil API'de tek hesap, iki taraf: kurum personeli girer ve kurum panelini tek kullanımlık bağlantıyla açar;
 * bildirimler taraflara ayrılır; veli portalı kurumun paketindeki bölümleri bildirir; kurumun kapattığı soru
 * modülünde soru gönderilemez. Demo veriler: kurum sahibi, Ayşe Yılmaz (öğretmen + Başarı Etüt Merkezi öğretmeni),
 * demo veli (özel ders + kurumda Ali Demirtaş'ın velisi). Test değiştirdiği kayıtları sonunda geri alır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const API = "/api/mobil/v1";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);
const centerNote = `E2e mobil kurum bildirimi ${stamp}`;
const privateNote = `E2e mobil özel ders bildirimi ${stamp}`;
const CENTER = `(SELECT id FROM "Center" WHERE slug = 'basari-etut-merkezi')`;
const AYSE = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
let original: { edition: string; disabledModules: string[] };

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

function client(request: APIRequestContext, token?: string) {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return {
    get: (path: string) => request.get(`${API}${path}`, { headers }),
    post: (path: string, data?: unknown) => request.post(`${API}${path}`, { headers, data: data ?? {} }),
    multipart: (path: string, form: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>) => request.post(`${API}${path}`, { headers, multipart: form }),
  };
}

async function login(request: APIRequestContext, identifier: string, password: string) {
  const response = await request.post(`${API}/oturum`, { data: { identifier, password, deviceName: "e2e-test" } });
  expect(response.status()).toBe(200);
  const { token, user } = await response.json();
  return { api: client(request, token), user };
}

test.beforeAll(async () => {
  [original] = await sql<{ edition: string; disabledModules: string[] }>(`SELECT edition::text, "disabledModules" FROM "Center" WHERE id = ${CENTER}`);
});

test.afterAll(async () => {
  await sql(`UPDATE "Center" SET edition = $1::"CenterEdition", "disabledModules" = $2 WHERE id = ${CENTER}`, [original.edition, original.disabledModules]);
  await sql(`DELETE FROM "Notification" WHERE title = ANY($1)`, [[centerNote, privateNote]]);
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-test'`);
});

test("kurum personeli girer, kurum panelini ve Excel dışa aktarımını tek kullanımlık bağlantıyla açar", async ({ request, playwright, baseURL }) => {
  const { api, user } = await login(request, "kurum@demo.vipozelders.local", "Kurum12345");
  expect(user).toMatchObject({ role: "CENTER", sides: { kurum: true, ozel: false, staff: true, portal: false } });
  expect((await (await api.get("/ben")).json()).role).toBe("CENTER");
  // Özel ders uçları kapalı; oturumu kapatmayan hata kodu
  const lessons = await api.get("/rezervasyonlar");
  expect(lessons.status()).toBe(403);
  expect((await lessons.json()).error.code).toBe("FORBIDDEN");
  // Öğretmen paneli sayfası personel bağlantısıyla açılmaz
  expect((await api.post("/web-oturum", { path: "/ogretmen-paneli/profil" })).status()).toBe(403);

  // Panel ve bildirim bağlantısı: tek kullanımlık giriş web oturumu açar
  const browser = await playwright.request.newContext({ baseURL });
  const panel = await (await api.post("/web-oturum", { path: "/kurum/sorular" })).json();
  const opened = await browser.get(panel.url);
  expect(opened.status()).toBe(200);
  expect(new URL(opened.url()).pathname).toBe("/kurum/sorular");
  // Bağlantı ikinci kez oturum açmaz
  const fresh = await playwright.request.newContext({ baseURL });
  expect(new URL((await fresh.get(panel.url)).url()).pathname).toMatch(/giris/);

  // Excel dışa aktarımı tarayıcıda indirilir
  const exported = await (await api.post("/web-oturum", { path: "/api/kurum/disa-aktar/borclar" })).json();
  const file = await fresh.get(exported.url);
  expect(file.status()).toBe(200);
  // Dosya (CSV/Excel) iner; giriş sayfası (HTML) değil
  expect(file.headers()["content-type"]).not.toContain("text/html");
  // Dış adres ya da kurum dışı yol kabul edilmez
  expect((await api.post("/web-oturum", { path: "//evil.example.com/kurum" })).status()).toBe(403);
  await browser.dispose();
  await fresh.dispose();
});

test("iki taraflı öğretmende bildirimler taraflara ayrılır", async ({ request }) => {
  await sql(`INSERT INTO "Notification" (id, "userId", type, title, body, "createdAt") VALUES ($1, ${AYSE}, 'center.e2e', $2, 'e2e', now()), ($3, ${AYSE}, 'e2e.private', $4, 'e2e', now())`, [
    `e2e-mc-${stamp}`,
    centerNote,
    `e2e-mp-${stamp}`,
    privateNote,
  ]);
  const { api, user } = await login(request, "ayse.yilmaz", "Ogretmen123");
  expect(user).toMatchObject({ role: "TEACHER", sides: { kurum: true, ozel: true, staff: true } });
  expect(user.unreadBySide.kurum).toBeGreaterThanOrEqual(1);
  expect(user.unreadBySide.ozel).toBeGreaterThanOrEqual(1);
  expect(user.unreadBySide.kurum + user.unreadBySide.ozel).toBe(user.unreadNotifications);

  const titles = async (side: string) => ((await (await api.get(`/bildirimler?taraf=${side}`)).json()).items as { title: string }[]).map((n) => n.title);
  expect(await titles("kurum")).toContain(centerNote);
  expect(await titles("kurum")).not.toContain(privateNote);
  expect(await titles("ozel")).toContain(privateNote);
  expect(await titles("ozel")).not.toContain(centerNote);
  // Taraf verilmezse hepsi
  const all = await titles("");
  expect(all).toEqual(expect.arrayContaining([centerNote, privateNote]));

  // Kurum tarafında "tümünü okundu say" özel ders bildirimlerine dokunmaz
  await api.post("/bildirimler/okundu", { taraf: "kurum" });
  const rows = await sql<{ title: string; readAt: Date | null }>(`SELECT title, "readAt" FROM "Notification" WHERE title = ANY($1)`, [[centerNote, privateNote]]);
  expect(rows.find((r) => r.title === centerNote)?.readAt).not.toBeNull();
  expect(rows.find((r) => r.title === privateNote)?.readAt).toBeNull();

  // Panel personel bildirimi uygulamada kurum panelinde açılır
  const panel = await (await api.post("/web-oturum", { path: "/kurum" })).json();
  expect(panel.url).toContain("/api/mobil/v1/web-giris?");
});

test("veli portalı paket bölümlerini bildirir; kurumun kapattığı soru modülünde soru gönderilmez", async ({ request }) => {
  const { api, user } = await login(request, "veli@demo.vipozelders.local", "Veli12345");
  expect(user).toMatchObject({ role: "STUDENT", sides: { kurum: true, ozel: true, portal: true, staff: false } });
  // Personel olmayan kurum paneli bağlantısı alamaz
  expect((await api.post("/web-oturum", { path: "/kurum" })).status()).toBe(403);

  const links = (await (await api.get("/kurum")).json()).items as { id: string; isStudentAccount: boolean; student: { firstName: string } }[];
  const ali = links.find((l) => l.student.firstName === "Ali")!;
  expect(ali.isStudentAccount).toBe(false);

  // Dershane paketi: tüm bölümler açık
  await sql(`UPDATE "Center" SET edition = 'DERSHANE', "disabledModules" = '{}' WHERE id = ${CENTER}`);
  const full = await (await api.get(`/kurum/${ali.id}`)).json();
  expect(full.modules).toEqual({ exams: true, payments: true, homework: true, study: true, questions: true, etuds: true, hall: true, schedule: true });

  // Etüt Merkezi paketi + kurum soru modülünü kapattı
  await sql(`UPDATE "Center" SET edition = 'ETUT', "disabledModules" = '{sorular}' WHERE id = ${CENTER}`);
  const etut = await (await api.get(`/kurum/${ali.id}`)).json();
  expect(etut.modules).toMatchObject({ schedule: false, questions: false, exams: true });
  const asked = await api.multipart(`/kurum/${ali.id}/sorular`, { subject: "Matematik", image: { name: "soru.png", mimeType: "image/png", buffer: PNG } });
  expect(asked.status()).toBe(422);
  expect((await asked.json()).error.message).toContain("kapattı");

  // Soru aboneliği veren öğretmen süzgeci
  const all = await (await request.get(`${API}/ogretmenler`)).json();
  const subscribers = await (await request.get(`${API}/ogretmenler?abonelik=1`)).json();
  expect(subscribers.total).toBeLessThanOrEqual(all.total);
});

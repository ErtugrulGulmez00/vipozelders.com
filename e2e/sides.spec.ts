import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Tek hesap, iki taraf: kişi kurum girişinden girerse kurum tarafını, özel ders girişinden girerse özel ders tarafını
 * görür; iki tarafı olan kişide diğer tarafa geçiş bağlantısı vardır ve bildirimler taraflara ayrılır.
 * Demo veriler: Ayşe Yılmaz hem özel ders öğretmeni hem Başarı Etüt Merkezi öğretmeni; demo veli özel ders alıyor ve
 * kurumda Ali Demirtaş'ın velisi. Ayrıca kurum personelinin aynı e-postayla öğretmen başvurusu ve velinin personel
 * olarak eklenmesi denenir. Test kendi oluşturduğu kayıtları sonunda siler.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const centerNote = `E2e kurum bildirimi ${stamp}`;
const privateNote = `E2e özel ders bildirimi ${stamp}`;
const staffEmail = `e2e-hoca-${stamp}@example.com`;
const staffLast = `Hoca${stamp}`;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function loginAt(page: Page, gate: "/giris" | "/kurum-giris", identifier: string, password: string) {
  await page.context().clearCookies();
  await page.goto(gate);
  await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/giris/);
}

const CENTER = `(SELECT id FROM "Center" WHERE slug = 'basari-etut-merkezi')`;
const PARENT = `(SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local')`;
const AYSE = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test.beforeAll(async () => {
  // Önceki testlerin başvuru sınırı (saatte 5) bu testi engellemesin
  await sql(`DELETE FROM "LoginAttempt" WHERE identifier LIKE 'apply:%'`);
});

test.afterAll(async () => {
  await sql(`DELETE FROM "Notification" WHERE title = ANY($1)`, [[centerNote, privateNote]]);
  await sql(`DELETE FROM "Notification" WHERE "userId" = ${PARENT} AND type = 'center.staff'`);
  await sql(`DELETE FROM "CenterMember" WHERE "centerId" = ${CENTER} AND "userId" = ${PARENT}`);
  const staff = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [staffEmail]);
  await sql(`DELETE FROM "AuditLog" WHERE "actorId" = ANY($1)`, [staff.map((u) => u.id)]);
  await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [staff.map((u) => u.id)]);
  await sql(`DELETE FROM "TeacherApplication" WHERE email = $1`, [staffEmail]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = $1`, [staffEmail]);
});

test("kurumda da çalışan öğretmen kapıya göre paneli görür, bildirimleri taraflara ayrılır", async ({ page }) => {
  await sql(`INSERT INTO "Notification" (id, "userId", type, title, body, "createdAt") VALUES ($1, ${AYSE}, 'center.e2e', $2, 'e2e', now()), ($3, ${AYSE}, 'e2e.private', $4, 'e2e', now())`, [
    `e2e-c-${stamp}`,
    centerNote,
    `e2e-p-${stamp}`,
    privateNote,
  ]);

  // Kurum girişi → kurum paneli; özel ders menüsü yok, özel derse geçiş var
  await loginAt(page, "/kurum-giris", "ayse.yilmaz", "Ogretmen123");
  await expect(page).toHaveURL(/\/kurum$/);
  await expect(page.getByRole("link", { name: "Kazançlarım" })).toHaveCount(0);
  await page.goto("/kurum/bildirimler");
  await expect(page.getByText(centerNote)).toBeVisible();
  await expect(page.getByText(privateNote)).toHaveCount(0);
  await page.getByRole("link", { name: "Özel ders paneline geç" }).first().click();

  // Öğretmen paneli: kurum menü öğesi yok, kuruma geçiş var; yalnızca özel ders bildirimleri
  await expect(page).toHaveURL(/\/ogretmen-paneli$/);
  await expect(page.getByRole("link", { name: "Kurum paneli", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Kurum paneline geç" }).first()).toBeVisible();
  await page.goto("/ogretmen-paneli/bildirimler");
  await expect(page.getByText(privateNote)).toBeVisible();
  await expect(page.getByText(centerNote)).toHaveCount(0);

  // Özel ders girişi → öğretmen paneli
  await loginAt(page, "/giris", "ayse.yilmaz", "Ogretmen123");
  await expect(page).toHaveURL(/\/ogretmen-paneli$/);
});

test("velinin e-postası personele yazılınca aynı hesap kuruma eklenir; kapıya göre taraf açılır", async ({ page }) => {
  await loginAt(page, "/kurum-giris", "kurum.demo", "Kurum12345");
  await page.goto("/kurum/personel");
  await page.getByLabel("Ad", { exact: true }).fill("Fatma");
  await page.getByLabel("Soyad", { exact: true }).fill("Demirtaş");
  await page.getByLabel("E-posta", { exact: true }).fill("veli@demo.vipozelders.local");
  await page.getByRole("button", { name: "Personeli ekle" }).click();
  await expect(page.getByText("Bu e-postayla kayıtlı hesap kuruma eklendi", { exact: false })).toBeVisible();

  // Kurum girişi → kurum paneli; özel ders tarafına ve veli portalına geçiş
  await loginAt(page, "/kurum-giris", "veli@demo.vipozelders.local", "Veli12345");
  await expect(page).toHaveURL(/\/kurum$/);
  await expect(page.getByRole("link", { name: "Özel ders tarafına geç" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Veli / öğrenci portalı" }).first()).toBeVisible();

  // Özel ders girişi → veli paneli; kurum paneline ve kurum tarafına geçiş
  await loginAt(page, "/giris", "veli@demo.vipozelders.local", "Veli12345");
  await expect(page).toHaveURL(/\/hesabim$/);
  await expect(page.getByRole("link", { name: "Kurum paneline geç" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Kurum tarafına geç" }).first().click();
  await expect(page).toHaveURL(/\/hesabim\/kurum$/);
  await expect(page.getByRole("link", { name: "Derslerim" })).toHaveCount(0);
});

test("öğrencinin e-postası sitede kayıtlıysa hesap açılmaz, davet gider; öğrenci kendi hesabıyla bağlanır", async ({ page }) => {
  const [ali] = await sql<{ id: string; email: string | null }>(`SELECT s.id, s.email FROM "CenterStudent" s WHERE s."centerId" = ${CENTER} AND s."firstName" = 'Ali' AND s."lastName" = 'Demirtaş'`);
  const kerem = "ogrenci@demo.vipozelders.local";
  try {
    await loginAt(page, "/kurum-giris", "kurum.demo", "Kurum12345");
    await page.goto(`/kurum/ogrenciler/${ali.id}`);
    // Öğretmen/personel e-postası öğrenci hesabına yazılamaz
    await page.getByLabel("Öğrencinin e-postası").fill("etut.ogretmen@demo.vipozelders.local");
    await page.getByRole("button", { name: "Öğrenci giriş hesabı aç" }).click();
    await expect(page.getByText("öğretmen ya da kurum personeli hesabında kayıtlı", { exact: false })).toBeVisible();
    // Sitede kayıtlı öğrenci e-postası → davet
    await page.getByLabel("Öğrencinin e-postası").fill(kerem);
    await page.getByRole("button", { name: "Öğrenci giriş hesabı aç" }).click();
    // Kart "davet bekleniyor" durumuna geçer
    await expect(page.getByText(`Davet gönderildi: ${kerem}`)).toBeVisible();

    const [mail] = await sql<{ text: string }>(`SELECT text FROM "EmailMessage" WHERE "to" = $1 AND subject LIKE 'Öğrenci hesabı daveti%' ORDER BY "createdAt" DESC LIMIT 1`, [kerem]);
    const invitePath = mail.text.match(/\/kurum-davet\/[A-Za-z0-9_-]+/)?.[0];
    expect(invitePath).toBeTruthy();

    // Öğrenci davet bağlantısını kurum girişinden açıp onaylar
    await page.context().clearCookies();
    await page.goto(invitePath!);
    await expect(page.getByRole("heading", { name: /öğrenci hesabı/ })).toBeVisible();
    // Davetin giriş düğmesi kurum kapısına götürür
    await page.locator('a[href^="/kurum-giris?next="]').click();
    await expect(page).toHaveURL(/\/kurum-giris\?next=/);
    await page.getByLabel("E-posta veya kullanıcı adı").fill(kerem);
    await page.getByLabel("Şifre", { exact: true }).fill("Ogrenci123");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await page.getByRole("button", { name: "Hesabıma bağla" }).click();
    await expect(page.getByText("Hesabınız öğrenciye bağlandı", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bilgilerim" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Derslerim" })).toHaveCount(0);
  } finally {
    await sql(`DELETE FROM "CenterGuardian" WHERE "studentId" = $1 AND "isStudentAccount" = true`, [ali.id]);
    await sql(`UPDATE "CenterStudent" SET email = $2 WHERE id = $1`, [ali.id, ali.email]);
    await sql(`DELETE FROM "EmailMessage" WHERE "to" = $1 AND subject LIKE 'Öğrenci hesabı daveti%'`, [kerem]);
  }
});

test("kurum personeli aynı e-postayla öğretmen başvurusu yapar; onayda kurum hesabına öğretmen paneli eklenir", async ({ page }) => {
  test.setTimeout(180_000);
  // Kurum, e-postasıyla yeni personel açar (kurum hesabı)
  await loginAt(page, "/kurum-giris", "kurum.demo", "Kurum12345");
  await page.goto("/kurum/personel");
  await page.getByLabel("Ad", { exact: true }).fill("E2e");
  await page.getByLabel("Soyad", { exact: true }).fill(staffLast);
  await page.getByLabel("E-posta", { exact: true }).fill(staffEmail);
  await page.getByRole("button", { name: "Personeli ekle" }).click();
  await expect(page.getByText("Personel hesabı açıldı.", { exact: false })).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();

  // Aynı e-postayla öğretmen başvurusu kabul edilir
  await page.context().clearCookies();
  await page.goto("/ogretmen-ol");
  await page.getByLabel("Ad", { exact: true }).fill("E2e");
  await page.getByLabel("Soyad", { exact: true }).fill(staffLast);
  await page.getByLabel("E-posta").fill(staffEmail);
  await page.getByLabel("Cep telefonu").fill("0532 444 55 77");
  await page.getByLabel("Ders verdiğiniz kademe ve dersler").fill("Lise fizik");
  await page.getByLabel(/platform dışına taşımayacağımı/).check();
  await page.getByLabel(/KVKK Aydınlatma Metni/).check();
  await page.getByRole("button", { name: "Başvurumu gönder" }).click();
  await expect(page.getByText("Başvurunuz alındı!", { exact: false })).toBeVisible();

  // Yönetici onaylar: yeni hesap açılmaz, kurum hesabına öğretmen paneli eklenir
  await loginAt(page, "/giris", "admin", "Yonetici123");
  await page.goto("/yonetim/basvurular");
  const card = page.locator("div.rounded-3xl", { hasText: `E2e ${staffLast}` }).first();
  await expect(card.getByText("Bu e-posta bir kurum personeli hesabına ait")).toBeVisible();
  await card.getByRole("button", { name: "Onayla ve hesap aç" }).click();
  await expect(page.getByText("o hesaba öğretmen paneli eklendi", { exact: false })).toBeVisible();
  const [user] = await sql<{ role: string; members: number; profiles: number }>(
    `SELECT u.role, (SELECT count(*)::int FROM "CenterMember" m WHERE m."userId" = u.id AND m."isActive") AS members, (SELECT count(*)::int FROM "TeacherProfile" p WHERE p."userId" = u.id) AS profiles FROM "User" u WHERE u.email = $1`,
    [staffEmail],
  );
  expect(user).toEqual({ role: "TEACHER", members: 1, profiles: 1 });

  // Aynı kullanıcı adı ve şifre: özel ders girişi öğretmen panelini, kurum girişi kurum panelini açar
  await page.context().clearCookies();
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(username);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("HocaSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("HocaSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/ogretmen-paneli$/);
  await loginAt(page, "/kurum-giris", username, "HocaSifre123");
  await expect(page).toHaveURL(/\/kurum$/);
});

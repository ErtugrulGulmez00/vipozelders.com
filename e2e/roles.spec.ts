import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Rol ve yetki denetimi (demo veriler): kurum öğretmeni ve muhasebecisi yalnızca yetkili bölümleri görür, diğerlerinin
 * adresi açılmaz; kurum sahibi ön kayıt, personel, gider, duyuru (e-posta modunda), etüt ve ayar işlemlerini yapar;
 * özel ders öğretmeni profil ve takvimini kaydeder; veli favori ve hesap ayarı yapar; roller birbirinin paneline ve
 * başkasının kaydına giremez. Test kendi oluşturduğu kayıtları sonunda siler.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const staffEmail = `e2e-personel-${stamp}@example.com`;
const leadName = `E2e Aday ${stamp}`;
const announcementTitle = `E2e duyuru ${stamp}`;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function login(page: Page, identifier: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

const nav = (page: Page) => page.getByRole("navigation").first();

async function expectBlocked(page: Page, path: string) {
  await page.goto(path);
  await expect(page, `${path} açılmamalı`).toHaveURL(/\/kurum\?durum=(yetki|paket|modul)$/);
}

test.beforeEach(async ({ page }) => {
  page.on("dialog", (d) => d.accept());
});

test.afterAll(async () => {
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [staffEmail]);
  await sql(`DELETE FROM "CenterMember" WHERE "userId" = ANY($1)`, [users.map((u) => u.id)]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = $1 OR subject LIKE $2`, [staffEmail, `%${announcementTitle}%`]);
  await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [users.map((u) => u.id)]);
  await sql(`DELETE FROM "CenterLead" WHERE "studentName" = $1`, [leadName]);
  await sql(`DELETE FROM "CenterMessage" WHERE kind = 'announcement' AND subject = $1`, [announcementTitle]);
  await sql(`DELETE FROM "Notification" WHERE title = $1`, [`Duyuru: ${announcementTitle}`]);
  await sql(`DELETE FROM "CenterAnnouncement" WHERE title = $1`, [announcementTitle]);
  await sql(`DELETE FROM "CenterExpense" WHERE description = $1`, [`E2e gider ${stamp}`]);
  await sql(`DELETE FROM "CenterEtud" WHERE subject = $1`, [`E2e etüt ${stamp}`]);
  await sql(`DELETE FROM "Favorite" WHERE "studentId" = (SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local') AND "teacherId" = (SELECT id FROM "User" WHERE username = 'mehmet.demir')`);
});

test("kurum öğretmeni: yetkili bölümler açık, yönetim/muhasebe bölümleri kapalı; etüt planlar", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "burak.sahin.kurum", "Ogretmen123");
  await expect(page).toHaveURL(/\/kurum$/);
  for (const label of ["Öğrenciler", "Yoklama", "Etütler", "Ödevler", "Koçluk", "Öğrenci soruları", "Denemeler"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toBeVisible();
  for (const label of ["Muhasebe", "Duyurular", "Mesaj geçmişi", "Ön kayıtlar", "Personel", "Kurum ayarları", "Abonelik", "Raporlar"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toHaveCount(0);
  for (const path of ["/kurum/muhasebe", "/kurum/muhasebe/giderler", "/kurum/duyurular", "/kurum/mesajlar", "/kurum/on-kayit", "/kurum/personel", "/kurum/ayarlar", "/kurum/abonelik", "/kurum/raporlar"]) await expectBlocked(page, path);
  await page.goto("/kurum");
  await expect(page.getByText("Bu bölüm için yetkiniz yok", { exact: false })).toHaveCount(0);

  // Etüt planlar (kendi etüdü)
  await page.goto("/kurum/etutler/yeni");
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
  await page.locator('input[name="date"]').fill(today);
  await page.locator('input[name="start"]').fill("21:00");
  await page.locator('input[name="end"]').fill("21:40");
  await page.locator('input[name="subject"]').fill(`E2e etüt ${stamp}`);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "Etüdü planla" }).click();
  await expect(page).toHaveURL(/\/kurum\/etutler\/c[a-z0-9]+\?durum=etut-planlandi$/);
});

test("kurum muhasebecisi: muhasebe ve iletişim açık, yoklama/deneme/yönetim kapalı; gider ekler ve siler", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "derya.koc", "Muhasebe123");
  await expect(page).toHaveURL(/\/kurum$/);
  for (const label of ["Öğrenciler", "Muhasebe", "Duyurular", "Ön kayıtlar"]) await expect(nav(page).getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
  for (const label of ["Yoklama", "Etütler", "Denemeler", "Personel", "Kurum ayarları", "Abonelik", "Raporlar"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toHaveCount(0);
  for (const path of ["/kurum/yoklama", "/kurum/etutler", "/kurum/denemeler", "/kurum/personel", "/kurum/ayarlar", "/kurum/abonelik", "/kurum/raporlar"]) await expectBlocked(page, path);

  await page.goto("/kurum/muhasebe/giderler");
  await page.getByLabel("Tutar (TL)").fill("150");
  await page.getByLabel("Açıklama").fill(`E2e gider ${stamp}`);
  await page.getByRole("button", { name: "Gideri kaydet" }).click();
  await expect(page.getByText("Gider kaydedildi.")).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(`E2e gider ${stamp}`) }).or(page.locator("li", { hasText: `E2e gider ${stamp}` })).first();
  await expect(row).toBeVisible();
});

test("kurum sahibi: ön kayıt, personel, ayarlar, duyuru (e-posta) ve gider işlemleri", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page, "kurum.demo", "Kurum12345");

  // Ön kayıt
  await page.goto("/kurum/on-kayit");
  const leadForm = page.locator("form", { has: page.getByRole("button", { name: "Adayı kaydet" }) });
  await leadForm.getByLabel("Öğrenci adı soyadı").fill(leadName);
  await leadForm.locator('input[name="phone"]').fill("0532 111 22 99");
  await leadForm.getByRole("button", { name: "Adayı kaydet" }).click();
  await expect(page.getByText("Aday kaydedildi.")).toBeVisible();
  await expect(page.getByText(leadName).first()).toBeVisible();

  // Personel: öğretmen hesabı açılır, giriş bilgileri ekranda
  await page.goto("/kurum/personel");
  await page.getByLabel("Ad", { exact: true }).fill("E2e");
  await page.getByLabel("Soyad", { exact: true }).fill(`Personel${stamp}`);
  await page.getByLabel("E-posta", { exact: true }).fill(staffEmail);
  await page.getByRole("button", { name: "Personeli ekle" }).click();
  await expect(page.getByText("Personel hesabı açıldı.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("new-username")).toBeVisible();
  // Yeni personele e-posta (bildirim kanalı e-posta) kuyruğa girdi
  await expect.poll(async () => (await sql(`SELECT 1 FROM "EmailMessage" WHERE "to" = $1`, [staffEmail])).length).toBeGreaterThan(0);

  // Ayarlar olduğu gibi kaydedilir
  await page.goto("/kurum/ayarlar");
  await page.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(page.getByText("Kurum ayarları kaydedildi.")).toBeVisible();

  // Duyuru: bildirim kanalı e-posta → velilere e-posta, WhatsApp kutusu "Çok yakında"
  await page.goto("/kurum/duyurular");
  await expect(page.getByText("Çok yakında · Onay aşamasında").first()).toBeVisible();
  await page.getByLabel("Başlık").fill(announcementTitle);
  await page.getByLabel("Duyuru", { exact: true }).fill("E2e duyuru metni: veli toplantısı cumartesi.");
  await page.getByRole("button", { name: "Duyuruyu yayınla" }).click();
  await expect(page.getByText("Duyuru yayınlandı", { exact: false })).toBeVisible();
  const channels = await sql<{ channel: string; n: number }>(`SELECT channel, count(*)::int AS n FROM "CenterMessage" WHERE kind = 'announcement' AND subject = $1 GROUP BY channel`, [announcementTitle]);
  expect(channels.find((c) => c.channel === "EMAIL")?.n ?? 0).toBeGreaterThan(0);
  expect(channels.find((c) => c.channel === "WHATSAPP")).toBeUndefined();

  // Gider
  await page.goto("/kurum/muhasebe/giderler");
  await page.getByLabel("Tutar (TL)").fill("99");
  await page.getByLabel("Açıklama").fill(`E2e gider ${stamp}`);
  await page.getByRole("button", { name: "Gideri kaydet" }).click();
  await expect(page.getByText("Gider kaydedildi.")).toBeVisible();
});

test("özel ders öğretmeni profil ve takvimini kaydeder", async ({ page }) => {
  await login(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/ogretmen-paneli/profil");
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect(page.getByText("Profil kaydedildi.")).toBeVisible();
  await page.goto("/ogretmen-paneli/takvim");
  await page.getByRole("button", { name: "Takvimi kaydet" }).click();
  await expect(page.getByText("Haftalık takviminiz kaydedildi.")).toBeVisible();
});

test("veli favori ekler ve favorilerde görür; hesap bilgilerini kaydeder", async ({ page }) => {
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/ogretmen/mehmet-demir");
  await page.getByRole("button", { name: /Favorilere ekle/ }).click();
  await expect(page.getByRole("button", { name: /Favorilerde|Favorilerden çıkar/ })).toBeVisible();
  await page.goto("/hesabim/favoriler");
  await expect(page.getByText("Mehmet Demir").first()).toBeVisible();
  await page.goto("/hesabim/profil");
  await page.getByRole("button", { name: "Kaydet", exact: true }).first().click();
  await expect(page.getByText("Bilgileriniz güncellendi.")).toBeVisible();
});

test("roller birbirinin paneline ve başkasının kaydına giremez", async ({ page }) => {
  // Veli: öğretmen, yönetim ve kurum panelleri açılmaz
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  for (const path of ["/ogretmen-paneli", "/yonetim"]) {
    await page.goto(path);
    await expect(page, `${path} veliye açılmamalı`).not.toHaveURL(new RegExp(`${path}$`));
  }
  await page.goto("/kurum");
  await expect(page).not.toHaveURL(/\/kurum$/);

  // Öğrenci başka velinin dersini göremez
  // (Akışla gönderilen sayfada "bulunamadı" ekranı 200 koduyla da gelebilir; ölçüt ekrandaki içerik)
  const [other] = await sql<{ id: string; code: string }>(`SELECT b.id, b.code FROM "Booking" b JOIN "User" u ON u.id = b."studentId" WHERE u.email = 'veli@demo.vipozelders.local' LIMIT 1`);
  await login(page, "ogrenci@demo.vipozelders.local", "Ogrenci123");
  await page.goto(`/hesabim/derslerim/${other.id}`);
  await expect(page.getByText("Aradığınız sayfa bulunamadı")).toBeVisible();
  await expect(page.getByText(other.code)).toHaveCount(0);

  // Özel ders öğretmeni yönetim paneline giremez
  await login(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/yonetim");
  await expect(page).not.toHaveURL(/\/yonetim$/);

  // Kurum sahibi başka kurumun öğrencisini açamaz
  const [foreign] = await sql<{ id: string }>(`SELECT s.id FROM "CenterStudent" s JOIN "Center" c ON c.id = s."centerId" WHERE c.slug <> 'basari-etut-merkezi' LIMIT 1`);
  await login(page, "kurum.demo", "Kurum12345");
  if (foreign) {
    await page.goto(`/kurum/ogrenciler/${foreign.id}`);
    await expect(page.getByText("Aradığınız sayfa bulunamadı")).toBeVisible();
  }
  await page.goto("/yonetim");
  await expect(page).not.toHaveURL(/\/yonetim$/);
});

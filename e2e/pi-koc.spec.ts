import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Pi Koç: tanıtım sayfası ve başvuru; yönetici "Bireysel koç" türünde hesap açar → koç ilk girişte şifresini belirler,
 * yalnızca takip bölümlerini görür (sınıf, yoklama, etüt, personel yok; adresle de açılmaz) → abonelikte Pi Koç fiyatları çıkar.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const centerName = `E2e Koç ${stamp}`;
const ownerEmail = `e2e-koc-${stamp}@example.com`;
const applicantEmail = `e2e-koc-basvuru-${stamp}@example.com`;

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

test.afterAll(async () => {
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [ownerEmail]);
  const ids = users.map((u) => u.id);
  await sql(`DELETE FROM "Center" WHERE name = $1`, [centerName]);
  await sql(`DELETE FROM "Notification" WHERE "userId" = ANY($1)`, [ids]);
  await sql(`DELETE FROM "AuditLog" WHERE "actorId" = ANY($1) OR "entityId" = ANY($1) OR details::text LIKE $2`, [ids, `%${centerName}%`]);
  await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [ids]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = ANY($1)`, [[ownerEmail, applicantEmail]]);
  await sql(`DELETE FROM "CenterApplication" WHERE email = $1`, [applicantEmail]);
  await sql(`DELETE FROM "Notification" WHERE type = 'center.application' AND body LIKE $1`, [`%${centerName}%`]);
});

test("Pi Koç sayfası fiyatları gösterir, başvuru yönetime düşer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Koç musunuz/ }).click();
  await expect(page).toHaveURL(/\/pi-koc$/);
  await expect(page.getByRole("heading", { level: 1, name: /Öğrencilerinizi tek panelden/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bu paketle başvur" })).toHaveCount(6);
  await expect(page.getByText("₺299", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Bu paketle başvur" }).nth(2).click();
  await expect(page).toHaveURL(/ogrenci=10#basvuru$/);
  await expect(page.locator("#k-count")).toHaveValue("10");
  await page.getByLabel("Panelde görünecek ad").fill(centerName);
  await page.getByLabel("Adınız soyadınız").fill("Deniz Koç");
  await page.getByLabel("Cep telefonu").fill("05321234567");
  await page.getByLabel("E-posta").fill(applicantEmail);
  await page.locator('input[name="kvkk"]').check();
  await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
  await expect(page.getByText("Başvurunuz alındı", { exact: false })).toBeVisible();
  const [application] = await sql<{ kind: string; studentCount: string }>(`SELECT kind::text, "studentCount" FROM "CenterApplication" WHERE email = $1`, [applicantEmail]);
  expect(application).toMatchObject({ kind: "COACH", studentCount: "10" });
});

test("yönetici koç hesabı açar; koç yalnızca takip bölümlerini görür", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "admin", "Yonetici123");
  await page.goto("/yonetim/kurumlar");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Kurumu aç" }) });
  await form.getByLabel("Kurum adı").fill(centerName);
  await form.getByLabel("Tür").selectOption("COACH");
  await form.getByLabel("Pi Koç öğrenci sınırı").fill("5");
  await form.getByLabel("Ad", { exact: true }).fill("Deniz");
  await form.getByLabel("Soyad").fill("Koç");
  await form.getByLabel("E-posta", { exact: true }).fill(ownerEmail);
  await form.getByRole("button", { name: "Kurumu aç" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();
  const [center] = await sql<{ kind: string; studentLimit: number; disabledModules: string[] }>(`SELECT kind::text, "studentLimit", "disabledModules" FROM "Center" WHERE name = $1`, [centerName]);
  expect(center).toMatchObject({ kind: "COACH", studentLimit: 5 });
  expect(center.disabledModules).toContain("etutler");

  await login(page, username, password);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("KocSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("KocSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/kurum$/);

  const nav = page.getByRole("navigation").first();
  for (const label of ["Öğrenciler", "Ödevler", "Kaynaklar ve kitaplar", "Koçluk", "Denemeler", "Muhasebe", "Abonelik"]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  for (const label of ["Sınıflar", "Ders programı", "Yoklama", "Etütler", "Çalışma salonu", "Sınıf defteri", "Derslikler", "Raporlar", "Personel"]) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);

  await page.goto("/kurum/abonelik");
  await expect(page.getByText("Pi Koç · 5 öğrenciye kadar")).toBeVisible();
  await expect(page.getByText("Pi Koç fiyatları")).toBeVisible();
  await expect(page.getByText("Öğrenci sayısına göre fiyat")).toHaveCount(0);

  // Kapalı bölümler adresle de açılmaz
  for (const section of ["siniflar", "program", "yoklama", "derslikler", "raporlar", "personel"]) {
    await page.goto(`/kurum/${section}`);
    await expect(page).toHaveURL(/\/kurum\?durum=koc$/);
  }
  await expect(page.getByText("Bu bölüm Pi Koç'ta yok.")).toBeVisible();

  // Koç türünü kendisi değiştiremez; açık bölümler sorunsuz açılır
  await page.goto("/kurum/ayarlar");
  await expect(page.getByRole("heading", { name: "Ayarlar", exact: true })).toBeVisible();
  await expect(page.getByLabel("Kurum türü")).toHaveCount(0);
  for (const section of ["ogrenciler", "odevler", "kaynaklar", "kocluk", "sorular", "denemeler", "muhasebe", "duyurular", "mesajlar"]) {
    const response = await page.goto(`/kurum/${section}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/kurum/${section}`));
  }
});

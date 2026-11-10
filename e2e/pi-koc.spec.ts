import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Pi Koç: tanıtım sayfası ve başvuru; yönetici "Bireysel koç" türünde hesap açar → koç ilk girişte şifresini belirler,
 * kendi paneline (/koc) düşer: öğrenci ekler, soru ve deneme girer, grafikleri görür; kurum paneli adresleri /koc'a döner.
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
  // Koç kurum paneline değil kendi paneline (Pi Koç) düşer
  await expect(page).toHaveURL(/\/koc$/);
  const nav = page.getByRole("navigation").first();
  for (const label of ["Genel bakış", "Öğrencilerim", "Haftalık görüşmeler", "Kaynak kütüphanesi", "Hesap ve abonelik"]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();

  // Kurum paneli adresleri Pi Koç'a döner
  for (const path of ["/kurum", "/kurum/siniflar", "/kurum/ogrenciler"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/koc$/);
  }

  // Öğrenci ekle → öğrenci sayfası
  await page.goto("/koc/ogrenciler/yeni");
  await page.getByLabel("Ad", { exact: true }).fill("Elif");
  await page.getByLabel("Soyad", { exact: true }).fill(`Koç${stamp}`);
  await page.locator("select[name=gradeName]").selectOption("12. sınıf");
  await page.locator("select[name=targetExam]").selectOption("YKS (Sayısal)");
  await page.locator("select[name=coachWeekday]").selectOption("2");
  await page.getByLabel("Saat", { exact: true }).fill("18:30");
  await page.getByRole("button", { name: "Öğrenciyi ekle" }).click();
  await expect(page).toHaveURL(/\/koc\/ogrenciler\/c[a-z0-9]+\?durum=eklendi$/);
  await expect(page.getByRole("heading", { name: `Elif Koç${stamp}` })).toBeVisible();
  const studentUrl = page.url().split("?")[0];

  // Soru takibi; doğru + yanlış çözülenden fazla olamaz
  await page.goto(`${studentUrl}?sekme=sorular`);
  await page.locator("input[name=subject]").fill("Matematik");
  await page.locator("input[name=solved]").fill("40");
  await page.locator("input[name=correct]").fill("30");
  await page.locator("input[name=wrong]").fill("6");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByText("Soru kaydı eklendi.")).toBeVisible();
  await page.locator("input[name=subject]").fill("Fizik");
  await page.locator("input[name=solved]").fill("10");
  await page.locator("input[name=correct]").fill("9");
  await page.locator("input[name=wrong]").fill("5");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByText("Doğru + yanlış, çözülen sorudan fazla olamaz.")).toBeVisible();

  // Deneme sonucu (TYT): Türkçe 30 doğru 8 yanlış → 28 net
  await page.goto(`${studentUrl}?sekme=denemeler`);
  await page.locator("select[name=kind]").selectOption("TYT");
  await page.locator("input[name=name]").fill("E2e TYT 1");
  await page.getByLabel("Türkçe doğru").fill("30");
  await page.getByLabel("Türkçe yanlış").fill("8");
  await page.getByRole("button", { name: "Sonucu kaydet" }).click();
  await expect(page.getByText("Deneme sonucu kaydedildi.")).toBeVisible();
  const [exam] = await sql<{ net: number }>(`SELECT r.net FROM "CenterExamResult" r JOIN "CenterExam" e ON e.id = r."examId" JOIN "Center" c ON c.id = e."centerId" WHERE e.name = 'E2e TYT 1' AND c.name = $1`, [centerName]);
  expect(Number(exam.net)).toBe(28);

  // Genel bakış: göstergeler ve grafikler
  await page.goto(studentUrl);
  await expect(page.getByText("Son TYT neti")).toBeVisible();
  await expect(page.getByText("Son denemede dersler")).toBeVisible();
  await page.goto("/koc");
  await expect(page.getByRole("link", { name: new RegExp(`Elif Koç${stamp}`) }).first()).toBeVisible();
  await page.goto("/koc/abonelik");
  await expect(page.getByText("Pi Koç · 5 öğrenciye kadar")).toBeVisible();
});

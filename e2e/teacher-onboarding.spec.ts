import { rmSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/** Öğretmen başvurusu → yönetici tek tıkla hesap açar → öğretmen belge yükler → yönetici onaylar. */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const email = `e2e-basvuru-${stamp}@example.com`;
// Küçük ama geçerli bir PDF başlığı (dosya türü içerikten tanınır).
const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

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
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [email]);
  for (const { id } of users) {
    const documents = await sql<{ fileKey: string }>(`SELECT "fileKey" FROM "TeacherDocument" WHERE "teacherId" = $1`, [id]);
    for (const { fileKey } of documents) rmSync(join(process.env.STORAGE_DIR ?? "storage/uploads", fileKey), { force: true });
    await sql(`DELETE FROM "Notification" WHERE link LIKE $1 OR "userId" = $2`, [`%${id}%`, id]);
    await sql(`DELETE FROM "AuditLog" WHERE "entityId" = $1 OR "actorId" = $1`, [id]);
    await sql(`DELETE FROM "User" WHERE id = $1`, [id]);
  }
  await sql(`DELETE FROM "Notification" WHERE type = 'teacher.application' AND body LIKE $1`, [`%E2e Basvuru${stamp}%`]);
  await sql(`DELETE FROM "TeacherApplication" WHERE email = $1`, [email]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = $1`, [email]);
});

test("öğretmen başvurusu → hesap açılır → belge yüklenir ve onaylanır", async ({ page }) => {
  // 1) Ziyaretçi başvuru formunu doldurur
  await page.goto("/");
  await page.getByRole("link", { name: "Bize katılın" }).click();
  await expect(page).toHaveURL(/\/ogretmen-ol$/);
  await page.getByLabel("Ad", { exact: true }).fill("E2e");
  await page.getByLabel("Soyad", { exact: true }).fill(`Basvuru${stamp}`);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Cep telefonu").fill("0532 444 55 66");
  await page.getByLabel("Bulunduğunuz il").selectOption({ label: "İzmir" });
  await page.getByLabel("Öğretmenlik deneyimi (yıl)").fill("7");
  await page.getByLabel("Ders verdiğiniz kademe ve dersler").fill("Lise kimya, YKS AYT kimya");
  await page.getByLabel("Yüz yüze").check();
  await page.getByRole("button", { name: "Başvurumu gönder" }).click();
  // Platform kuralları ve KVKK onayı olmadan gönderilmez (tarayıcı zorunlu alan uyarısı)
  await expect(page.getByText("Başvurunuz alındı!", { exact: false })).toHaveCount(0);
  await page.getByLabel(/platform dışına taşımayacağımı/).check();
  await page.getByLabel(/KVKK Aydınlatma Metni/).check();
  await page.getByRole("button", { name: "Başvurumu gönder" }).click();
  await expect(page.getByText("Başvurunuz alındı!", { exact: false })).toBeVisible();
  const [application] = await sql<{ id: string; phone: string; cityName: string }>(
    `SELECT a.id, a.phone, c.name AS "cityName" FROM "TeacherApplication" a LEFT JOIN "City" c ON c.id = a."cityId" WHERE a.email = $1`,
    [email],
  );
  expect(application).toMatchObject({ phone: "05324445566", cityName: "İzmir" });
  expect((await sql(`SELECT 1 FROM "EmailMessage" WHERE "to" = $1`, [email])).length).toBe(1);

  // Aynı e-postayla ikinci başvuru kabul edilmez
  await page.goto("/ogretmen-ol");
  await page.getByLabel("Ad", { exact: true }).fill("E2e");
  await page.getByLabel("Soyad", { exact: true }).fill(`Basvuru${stamp}`);
  await page.getByLabel("E-posta").fill(email);
  await page.getByLabel("Cep telefonu").fill("05324445566");
  await page.getByLabel("Ders verdiğiniz kademe ve dersler").fill("Lise kimya");
  await page.getByLabel(/platform dışına taşımayacağımı/).check();
  await page.getByLabel(/KVKK Aydınlatma Metni/).check();
  await page.getByRole("button", { name: "Başvurumu gönder" }).click();
  await expect(page.getByText("başvurunuz zaten inceleniyor", { exact: false })).toBeVisible();

  // 2) Yönetici başvuruyu görür ve tek tıkla hesap açar
  await login(page, "admin", "Yonetici123");
  await expect(page.getByRole("link", { name: /yeni öğretmen başvurusu/ })).toBeVisible();
  await page.goto("/yonetim/basvurular");
  await expect(page.getByText("Lise kimya, YKS AYT kimya")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Onayla ve hesap aç" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();
  const [teacher] = await sql<{ id: string; experienceYears: number; offersInPerson: boolean }>(
    `SELECT u.id, p."experienceYears", p."offersInPerson" FROM "User" u JOIN "TeacherProfile" p ON p."userId" = u.id WHERE u.email = $1`,
    [email],
  );
  expect(teacher).toMatchObject({ experienceYears: 7, offersInPerson: true });

  // 3) Öğretmen girer, şifresini değiştirir ve kimlik belgesi yükler
  await login(page, username, password);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("YeniSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("YeniSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/ogretmen-paneli$/);
  // Belgeler menüde "Profilim" altında sekme
  await page.getByRole("link", { name: "Profilim" }).first().click();
  await page.getByRole("link", { name: "Belgelerim" }).first().click();
  await expect(page.getByText("Henüz belge yüklemediniz")).toBeVisible();
  await page.getByLabel("Belge türü").selectOption({ label: "Kimlik" });
  await page.locator('input[name="file"]').setInputFiles({ name: "kimlik.pdf", mimeType: "application/pdf", buffer: PDF });
  await expect(page.getByText("kimlik.pdf")).toBeVisible(); // seçilen dosyanın adı görünür
  await page.getByRole("button", { name: "Yükle" }).click();
  await expect(page.getByText("Belgeniz yüklendi", { exact: false })).toBeVisible();
  await expect(page.getByText("İnceleniyor")).toBeVisible();
  const fileHref = await page.getByRole("link", { name: "kimlik.pdf" }).getAttribute("href");
  expect(fileHref).toMatch(/^\/api\/dosya\/private\/belge\//);
  expect((await page.request.get(fileHref!)).status()).toBe(200); // sahibi açabilir

  // Belge herkese açık değildir
  const anonymous = await page.context().browser()!.newContext();
  expect((await anonymous.request.get(new URL(fileHref!, page.url()).toString())).status()).toBe(403);
  await anonymous.close();

  // 4) Yönetici belgeyi onaylar; öğretmen durumu görür
  await login(page, "admin", "Yonetici123");
  await page.goto(`/yonetim/ogretmenler/${teacher.id}?bolum=belgeler`);
  await expect(page.getByText("İnceleniyor", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Onayla" }).click();
  // İncelenen belgenin formu kalkar, durumu "Onaylandı" olur.
  await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Onayla" })).toHaveCount(0);
  await login(page, username, "YeniSifre123");
  await page.goto("/ogretmen-paneli/belgeler");
  await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sil" })).toHaveCount(0); // onaylı belge silinemez
  const notifications = await sql<{ title: string }>(`SELECT title FROM "Notification" WHERE "userId" = $1`, [teacher.id]);
  expect(notifications.map((n) => n.title)).toContain("Kimlik belgeniz onaylandı");
});

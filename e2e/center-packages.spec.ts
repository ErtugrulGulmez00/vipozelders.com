import { gateLogin } from "./gate-login";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Tek paket: yönetici 20 öğrenci kademesiyle kurum açar → kurum sahibi ilk girişte şifresini belirler, bütün bölümleri
 * görür → yönetici ödeme kaydeder (kademe 100 öğrenci) → abonelik sayfasında yeni kademe yazar.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const centerName = `E2e Paket ${stamp}`;
const ownerEmail = `e2e-paket-${stamp}@example.com`;

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
  await gateLogin(page, identifier, password);
}

const nav = (page: Page) => page.getByRole("navigation").first();

test.afterAll(async () => {
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [ownerEmail]);
  const ids = users.map((u) => u.id);
  await sql(`DELETE FROM "Center" WHERE name = $1`, [centerName]);
  await sql(`DELETE FROM "Notification" WHERE "userId" = ANY($1)`, [ids]);
  await sql(`DELETE FROM "AuditLog" WHERE "actorId" = ANY($1) OR "entityId" = ANY($1) OR details::text LIKE $2`, [ids, `%${centerName}%`]);
  await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [ids]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = $1`, [ownerEmail]);
});

test("yeni kurum bütün bölümleri görür; ödemeyle kademe yükselir", async ({ page }) => {
  test.setTimeout(180_000);

  // 1) Yönetici 20 öğrenci kademesiyle kurum açar
  await login(page, "admin", "Yonetici123");
  await page.goto("/yonetim/kurumlar");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Kurumu aç" }) });
  await form.getByLabel("Kurum adı").fill(centerName);
  await form.getByLabel("Tür").selectOption("ETUT");
  await form.getByLabel("Öğrenci kademesi").selectOption("STARTER");
  await form.getByLabel("Ad", { exact: true }).fill("Selin");
  await form.getByLabel("Soyad").fill("Paket");
  await form.getByLabel("E-posta", { exact: true }).fill(ownerEmail);
  await form.getByRole("button", { name: "Kurumu aç" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();
  const [center] = await sql<{ id: string; plan: string; studentLimit: number }>(`SELECT id, plan, "studentLimit" FROM "Center" WHERE name = $1`, [centerName]);
  expect(center).toMatchObject({ plan: "STARTER", studentLimit: 20 });
  // Kurum sahibine hoş geldin e-postası kuyruğa girdi
  expect((await sql(`SELECT 1 FROM "EmailMessage" WHERE "to" = $1`, [ownerEmail])).length).toBeGreaterThan(0);

  // 2) Kurum sahibi geçici şifreyle girer, şifresini belirler; bütün bölümleri görür
  await login(page, username, password);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("PaketSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("PaketSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/kurum$/);
  for (const label of ["Etüt planı", "Ödevler", "Denemeler", "Çalışma salonu", "Muhasebe", "Koçluk ve kaynaklar", "Duyuru ve mesajlar"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toBeVisible();
  // Etüt merkezinde dershane bölümleri (sınıf programı ve yoklaması, defter, derslik, rapor) yok
  for (const label of ["Ders programı", "Sınıf yoklaması", "Sınıf defteri", "Derslikler", "Raporlar"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toHaveCount(0);
  await page.goto("/kurum/abonelik");
  await expect(page.getByText("Etüt Merkezi · 20 öğrenciye kadar")).toBeVisible();

  // 3) Yönetici yıllık ödemeyi 100 öğrenci kademesiyle kaydeder
  await login(page, "admin", "Yonetici123");
  await page.goto(`/yonetim/kurumlar/${center.id}`);
  const payForm = page.locator("form", { has: page.getByRole("button", { name: "Ödemeyi kaydet ve süreyi uzat" }) });
  await payForm.getByLabel("Tutar (TL)").fill("49999");
  await payForm.getByLabel("Süre (ay)").fill("12");
  await payForm.getByLabel("Öğrenci kademesi").selectOption("PRO");
  await payForm.getByRole("button", { name: "Ödemeyi kaydet ve süreyi uzat" }).click();
  await expect(page.getByText("Ödeme kaydedildi.", { exact: false })).toBeVisible();
  const [updated] = await sql<{ plan: string; studentLimit: number; status: string }>(`SELECT plan, "studentLimit", status FROM "Center" WHERE id = $1`, [center.id]);
  expect(updated).toMatchObject({ plan: "PRO", studentLimit: 100, status: "ACTIVE" });

  // 4) Etüt merkezinde dershane bölümleri adresle de açılmaz; aboneliğinde yeni kademe yazar
  await login(page, username, "PaketSifre123");
  for (const section of ["derslikler", "raporlar", "program", "yoklama", "sinif-defteri"]) {
    await page.goto(`/kurum/${section}`);
    await expect(page).toHaveURL(/\/kurum$/);
  }
  await page.goto("/kurum/abonelik");
  await expect(page.getByText("Etüt Merkezi · 100 öğrenciye kadar")).toBeVisible();
});

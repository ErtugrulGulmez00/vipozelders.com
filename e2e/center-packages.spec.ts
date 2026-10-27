import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Kurum paketleri: yönetici Etüt Merkezi paketli kurum açar → kurum sahibi ilk girişte şifresini belirler, yalnızca
 * paketin bölümlerini görür (denemeler dahil) (Dershane bölümlerinin adresi açılmaz) → yönetici paketi Dershane'ye yükseltir ve yıllık
 * ödeme kaydeder (kademe 100 öğrenci) → kurum sahibi Dershane bölümlerini görür, abonelik sayfasında yeni paket yazar.
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
  await page.context().clearCookies();
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/giris/);
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

test("yönetici paket atar ve yükseltir; kurum sahibi pakete göre bölümleri görür", async ({ page }) => {
  test.setTimeout(180_000);

  // 1) Yönetici Etüt Merkezi paketi, 20 öğrenci kademesiyle kurum açar
  await login(page, "admin", "Yonetici123");
  await page.goto("/yonetim/kurumlar");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Kurumu aç" }) });
  await form.getByLabel("Kurum adı").fill(centerName);
  await form.getByLabel("Tür").selectOption("ETUT");
  await form.getByLabel("Paket").selectOption("ETUT");
  await form.getByLabel("Öğrenci kademesi").selectOption("STARTER");
  await form.getByLabel("Ad", { exact: true }).fill("Selin");
  await form.getByLabel("Soyad").fill("Paket");
  await form.getByLabel("E-posta", { exact: true }).fill(ownerEmail);
  await form.getByRole("button", { name: "Kurumu aç" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();
  const [center] = await sql<{ id: string; edition: string; plan: string; studentLimit: number }>(`SELECT id, edition, plan, "studentLimit" FROM "Center" WHERE name = $1`, [centerName]);
  expect(center).toMatchObject({ edition: "ETUT", plan: "STARTER", studentLimit: 20 });
  // Kurum sahibine hoş geldin e-postası kuyruğa girdi
  expect((await sql(`SELECT 1 FROM "EmailMessage" WHERE "to" = $1`, [ownerEmail])).length).toBeGreaterThan(0);

  // 2) Kurum sahibi geçici şifreyle girer, şifresini belirler; yalnızca Etüt Merkezi bölümlerini görür
  await login(page, username, password);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("PaketSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("PaketSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/kurum$/);
  for (const label of ["Etütler", "Ödevler", "Denemeler", "Çalışma salonu", "Muhasebe"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toBeVisible();
  for (const label of ["Ders programı", "Yoklama", "Sınıf defteri", "Derslikler", "Raporlar"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toHaveCount(0);
  await page.goto("/kurum/derslikler");
  await expect(page).toHaveURL(/\/kurum\?durum=paket$/);
  await expect(page.getByText("Bu bölüm Dershane paketinde", { exact: false })).toBeVisible();
  await page.goto("/kurum/raporlar");
  await expect(page).toHaveURL(/\/kurum\?durum=paket$/);
  await page.goto("/kurum/abonelik");
  await expect(page.getByText("Etüt Merkezi · 20 öğrenciye kadar")).toBeVisible();

  // 3) Yönetici paketi Dershane'ye yükseltir, yıllık ödemeyi 100 öğrenci kademesiyle kaydeder
  await login(page, "admin", "Yonetici123");
  await page.goto(`/yonetim/kurumlar/${center.id}`);
  const editForm = page.locator("form", { has: page.getByLabel("Durum") });
  await editForm.getByLabel("Paket").selectOption("DERSHANE");
  await editForm.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Kurum güncellendi.")).toBeVisible();
  const payForm = page.locator("form", { has: page.getByRole("button", { name: "Ödemeyi kaydet ve süreyi uzat" }) });
  await payForm.getByLabel("Tutar (TL)").fill("49999");
  await payForm.getByLabel("Süre (ay)").fill("12");
  await payForm.getByLabel("Öğrenci kademesi").selectOption("PRO");
  await payForm.getByRole("button", { name: "Ödemeyi kaydet ve süreyi uzat" }).click();
  await expect(page.getByText("Ödeme kaydedildi.", { exact: false })).toBeVisible();
  const [updated] = await sql<{ edition: string; plan: string; studentLimit: number; status: string }>(`SELECT edition, plan, "studentLimit", status FROM "Center" WHERE id = $1`, [center.id]);
  expect(updated).toMatchObject({ edition: "DERSHANE", plan: "PRO", studentLimit: 100, status: "ACTIVE" });

  // 4) Kurum sahibi Dershane bölümlerini görür; aboneliğinde yeni paket yazar
  await login(page, username, "PaketSifre123");
  await page.goto("/kurum");
  for (const label of ["Ders programı", "Yoklama", "Sınıf defteri", "Derslikler", "Raporlar"]) await expect(nav(page).getByRole("link", { name: label, exact: true })).toBeVisible();
  await page.goto("/kurum/derslikler");
  await expect(page.getByRole("heading", { name: "Derslikler" })).toBeVisible();
  await page.getByLabel("Derslik adı").fill("101");
  await page.getByLabel("Kapasite").fill("12");
  await page.getByRole("button", { name: "Ekle" }).click();
  await expect(page.getByText("Derslik eklendi.")).toBeVisible();
  await page.goto("/kurum/raporlar");
  await expect(page.getByRole("heading", { name: "Raporlar" })).toBeVisible();
  await page.goto("/kurum/abonelik");
  await expect(page.getByText("Dershane · 100 öğrenciye kadar")).toBeVisible();
});

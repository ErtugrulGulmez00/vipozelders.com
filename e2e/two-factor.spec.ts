import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { totpCode, totpStep } from "../src/server/auth/totp";

/** Yönetici iki adımlı doğrulamayı QR/anahtar ile kurar; sonraki girişte kod istenir. */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const USERNAME = `e2e.admin.${Date.now().toString(36)}`;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

test.beforeAll(async () => {
  // Demo yöneticinin şifresiyle (Yonetici123) geçici bir yönetici hesabı
  await sql(
    `INSERT INTO "User" (id, role, status, username, "passwordHash", "firstName", "lastName", "updatedAt")
     SELECT $1, 'ADMIN', 'ACTIVE', $2, "passwordHash", 'Test', 'Yönetici', now() FROM "User" WHERE username = 'admin'`,
    [`e2e${Date.now().toString(36)}`, USERNAME],
  );
});

test.afterAll(async () => {
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE username = $1`, [USERNAME]);
  for (const { id } of users) {
    await sql(`DELETE FROM "AuditLog" WHERE "actorId" = $1 OR "entityId" = $1`, [id]);
    await sql(`DELETE FROM "LoginAttempt" WHERE identifier = $1 OR identifier = $2`, [USERNAME, `2fa:${id}`]);
    await sql(`DELETE FROM "User" WHERE id = $1`, [id]);
  }
});

async function login(page: Page) {
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(USERNAME);
  await page.getByLabel("Şifre", { exact: true }).fill("Yonetici123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

/** Bir sonraki 30 sn'lik adımın kodu (aynı kod ikinci kez kabul edilmediği için). */
function freshCode(secret: string, offset = 0) {
  return totpCode(secret, totpStep() + offset);
}

test("yönetici iki adımlı doğrulamayı açar, girişte kod istenir", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/yonetim$/);
  await expect(page.getByText("İki adımlı doğrulama kapalı")).toBeVisible();

  await page.goto("/yonetim/guvenlik");
  await page.getByRole("button", { name: "Kurulumu başlat" }).click();
  const secretText = page.locator("p.font-mono");
  await expect(secretText).toBeVisible();
  await expect(page.locator("svg").first()).toBeVisible();
  const secret = (await secretText.innerText()).replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);

  // Yanlış kod reddedilir
  await page.getByLabel("Uygulamadaki kod").fill("000000");
  await page.getByRole("button", { name: "Onayla ve aç" }).click();
  await expect(page.getByText("Kod doğrulanamadı", { exact: false })).toBeVisible();

  await page.getByLabel("Uygulamadaki kod").fill(freshCode(secret));
  await page.getByRole("button", { name: "Onayla ve aç" }).click();
  await expect(page).toHaveURL(/durum=2fa-acildi/);
  await expect(page.getByText("İki adımlı doğrulama açıldı.", { exact: false })).toBeVisible();
  await expect(page.getByText(/Açık · /)).toBeVisible();

  // Çıkış → yeniden giriş: şifreden sonra kod istenir
  await page.context().clearCookies();
  await login(page);
  await expect(page).toHaveURL(/\/giris\/dogrulama/);
  await expect(page.getByRole("heading", { name: "İki adımlı doğrulama" })).toBeVisible();
  // Panel, kod girilmeden açılmaz
  await page.goto("/yonetim");
  await expect(page).toHaveURL(/\/giris/);
  await page.goto("/giris/dogrulama");
  await page.getByLabel("Doğrulama kodu").fill("123456");
  await page.getByRole("button", { name: "Doğrula ve giriş yap" }).click();
  await expect(page.getByText("Kod hatalı veya süresi geçmiş.")).toBeVisible();
  // Kurulumda kullanılan adım tekrar kabul edilmez; bir sonraki adımın kodu geçerlidir.
  await page.getByLabel("Doğrulama kodu").fill(freshCode(secret, 1));
  await page.getByRole("button", { name: "Doğrula ve giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
  await expect(page.getByText("İki adımlı doğrulama kapalı")).toHaveCount(0);

  const [row] = await sql<{ enabled: Date | null; secret: string | null }>(`SELECT "totpEnabledAt" AS enabled, "totpSecretEnc" AS secret FROM "User" WHERE username = $1`, [USERNAME]);
  expect(row.enabled).not.toBeNull();
  expect(row.secret).not.toContain(secret); // anahtar şifreli saklanır
});

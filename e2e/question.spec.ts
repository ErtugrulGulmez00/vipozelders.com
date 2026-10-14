import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Fotoğrafla soru: veli öğretmen profilinden "Fotoğrafla soru"yu seçer, fotoğrafı yükleyip (test) öder →
 * öğretmen talepler sayfasından soruyu açıp çözümü gönderir → veli çözümü görür.
 * Demo öğretmen ayse.yilmaz'ın bir soru çözüm dersine geçici soru ücreti verilir, sonunda geri alınır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);

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

let offeringId: string;

test.beforeAll(async () => {
  const [row] = await sql<{ id: string }>(
    `SELECT o.id FROM "TeacherOffering" o JOIN "User" u ON u.id = o."teacherId" JOIN "ServiceType" s ON s.id = o."serviceTypeId"
     WHERE u.username = 'ayse.yilmaz' AND s.slug = 'soru-cozum' AND o."isActive" ORDER BY o."createdAt" LIMIT 1`,
  );
  offeringId = row.id;
  await sql(`UPDATE "TeacherOffering" SET "questionPrice" = 15000 WHERE id = $1`, [offeringId]);
});

test.afterAll(async () => {
  await sql(`DELETE FROM "Booking" WHERE mode = 'QUESTION' AND "studentNote" LIKE $1`, [`%${stamp}%`]);
  await sql(`UPDATE "TeacherOffering" SET "questionPrice" = NULL WHERE id = $1`, [offeringId]);
});

test("veli fotoğrafla soru gönderir, öğretmen çözümü yollar", async ({ page }) => {
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto(`/rezervasyon?ders=${offeringId}&sekil=QUESTION`);
  await expect(page.getByRole("heading", { name: "Soruyu gönder" })).toBeVisible();
  await page.locator('input[name="image"]').setInputFiles({ name: "soru.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Not (isteğe bağlı)").fill(`Türev sorusu ${stamp}`);
  await page.getByLabel("Öğrencinin adı").fill("Ali");
  await page.getByLabel(/Ön Bilgilendirme Formu/).check();
  await page.getByRole("button", { name: "Ödemeye geç" }).click();
  await expect(page).toHaveURL(/\/odeme\/test\//);
  await page.getByRole("button", { name: /başarılı test/ }).click();
  await expect(page).not.toHaveURL(/\/odeme\/test\//);
  await page.screenshot({ path: "test-results/soru-odeme-sonrasi.png" });

  const [booking] = await sql<{ id: string; status: string }>(`SELECT id, status FROM "Booking" WHERE "studentNote" LIKE $1`, [`%${stamp}%`]);
  expect(booking.status).toBe("PENDING_APPROVAL");

  // Öğretmen: talepler → soruyu aç → çözümü gönder
  await login(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/ogretmen-paneli/talepler");
  await page.getByRole("link", { name: "Soruyu aç ve çöz" }).first().click();
  await page.goto(`/ogretmen-paneli/dersler/${booking.id}`);
  await expect(page.getByText(`Türev sorusu ${stamp}`)).toBeVisible();
  await page.getByLabel("Çözüm açıklaması").fill("Önce zincir kuralını uygularız.");
  await page.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(page.getByText("Çözüm gönderildi", { exact: false })).toBeVisible();

  // Veli çözümü görür
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto(`/hesabim/derslerim/${booking.id}`);
  await expect(page.getByText("Önce zincir kuralını uygularız.")).toBeVisible();
  await expect(page.getByText("Çözüm", { exact: true })).toBeVisible();
});

test("öğretmen profilinde fotoğrafla soru seçeneği", async ({ page }) => {
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/ogretmen/ayse-yilmaz");
  const offeringSelect = page.getByLabel("Ders", { exact: true });
  const value = await offeringSelect.locator(`option[value="${offeringId}"]`).getAttribute("value");
  await offeringSelect.selectOption(value!);
  await page.getByRole("button", { name: /Fotoğrafla soru/ }).click();
  await expect(page.getByText("Soru başı ücret")).toBeVisible();
  await page.getByRole("button", { name: "Soruyu gönder" }).click();
  await expect(page).toHaveURL(/sekil=QUESTION/);
});

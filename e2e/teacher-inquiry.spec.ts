import { expect, test } from "@playwright/test";
import pg from "pg";
import { gateLogin } from "./gate-login";
import { setLessonBooking } from "./lesson-booking";

/**
 * Vitrinden ders talebi (randevu kapalıyken): veli öğretmen profilinden talep gönderir → öğretmen "Ders talepleri"nde
 * görür, kabul eder ve velinin telefonunu görür. Randevu ve ödeme kutusu görünmez. Sonunda kayıtlar silinir.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const TEACHER = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
const PARENT = `(SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local')`;

async function sql(text: string) {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
}

// Testin açtığı Pi Koç hesabı (öğretmenin önceden yoksa) ve eklenen öğrenci silinir
async function cleanup() {
  await sql(`DELETE FROM "CenterStudent" WHERE id IN (SELECT "centerStudentId" FROM "TeacherInquiry" WHERE "teacherId" = ${TEACHER} AND "requesterId" = ${PARENT} AND "centerStudentId" IS NOT NULL)`);
  // Demo öğretmenin Pi Koç hesabı yoktur; talep kabulünde açılan hesap silinir
  await sql(`DELETE FROM "Center" WHERE kind = 'COACH' AND id IN (SELECT "centerId" FROM "CenterMember" WHERE "userId" = ${TEACHER} AND role = 'OWNER')`);
  await sql(`DELETE FROM "Notification" WHERE type LIKE 'center.koc_%' AND "userId" = ${TEACHER}`);
  await sql(`DELETE FROM "TeacherInquiry" WHERE "teacherId" = ${TEACHER} AND "requesterId" = ${PARENT}`);
  await sql(`DELETE FROM "Notification" WHERE type LIKE 'inquiry.%' AND "userId" IN (${TEACHER}, ${PARENT})`);
  await sql(`DELETE FROM "LoginAttempt" WHERE identifier = 'inquiry:' || ${PARENT}`);
}

test.beforeAll(async () => {
  await setLessonBooking(false);
  await cleanup();
});
test.afterAll(cleanup);

test("veli ders talebi gönderir, öğretmen kabul edip telefonu görür", async ({ page }) => {
  // Giriş yapmayan ziyaretçi: talep için giriş düğmesi, randevu kutusu yok
  await page.goto("/ogretmen/ayse-yilmaz");
  await expect(page.getByRole("heading", { name: "Ders talebi gönder" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Giriş yapıp talep gönder" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Randevu al" })).toHaveCount(0);

  await gateLogin(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/ogretmen/ayse-yilmaz");
  const form = page.locator("aside#randevu");
  await form.getByLabel("Öğrencinin adı").fill("Deniz");
  await form.getByLabel("Uygun günler ve saatler").fill("Hafta içi 18:00 sonrası");
  await form.getByLabel("Telefonunuz").fill("05321112233");
  await form.getByLabel(/telefon numaramın öğretmenle paylaşılmasını/).check();
  await form.getByRole("button", { name: "Ders talebi gönder" }).click();
  // Sayfa yenilenir: form yerine "talebiniz iletildi" kutusu kalır
  await expect(form.getByText("Talebiniz iletildi")).toBeVisible();
  await page.reload();
  await expect(form.getByText("Talebiniz iletildi")).toBeVisible();

  await gateLogin(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/ogretmen-paneli/ders-talepleri");
  await expect(page.getByText("Deniz", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("0532 111 22 33")).toHaveCount(0);
  await page.getByRole("button", { name: "Kabul et" }).first().click();
  await expect(page.getByText("Kabul ettiniz").first()).toBeVisible();
  await expect(page.locator("a[href='tel:05321112233']")).toBeVisible();
  // Adım 5: öğrenci öğretmenin Pi Koç'una eklendi
  const open = page.getByRole("link", { name: "Pi Koç'ta aç" });
  await expect(open).toBeVisible();
  await open.click();
  await expect(page.getByRole("heading", { name: /^Deniz / })).toBeVisible();
});

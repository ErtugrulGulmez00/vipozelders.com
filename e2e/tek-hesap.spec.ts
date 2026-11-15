import { expect, test } from "@playwright/test";
import pg from "pg";
import { gateLogin } from "./gate-login";
import { setLessonBooking } from "./lesson-booking";

/**
 * Tek hesap (özel ders ↔ Pi Koç):
 * 1. Talebi kabul edilen veli hesabı öğrenciye bağlı görünür; koç "Bu hesabı öğrenci hesabı yap" ile yeni hesap açmadan kullanır,
 *    öğrencinin kendi hesabının şifresini sıfırlayamaz.
 * 2. Koçun açtığı öğrenci hesabı özel ders kapısından da girer.
 * 3. Yönetim çift hesabı birleştirir: bağlantılar asıl hesaba taşınır, fazla hesap kapanır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const TEACHER = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
const PARENT = `(SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local')`;
const NEW_EMAIL = "tek-hesap-e2e@example.com";

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function cleanup() {
  await sql(`DELETE FROM "CenterStudent" WHERE id IN (SELECT "centerStudentId" FROM "TeacherInquiry" WHERE "teacherId" = ${TEACHER} AND "requesterId" = ${PARENT} AND "centerStudentId" IS NOT NULL)`);
  await sql(`DELETE FROM "TeacherInquiry" WHERE "teacherId" = ${TEACHER} AND "requesterId" = ${PARENT}`);
  await sql(`DELETE FROM "Notification" WHERE type LIKE 'inquiry.%' AND "userId" IN (${TEACHER}, ${PARENT})`);
  await sql(`DELETE FROM "LoginAttempt" WHERE identifier = 'inquiry:' || ${PARENT}`);
  await sql(`DELETE FROM "User" WHERE email = $1`, [NEW_EMAIL]);
  await sql(`UPDATE "User" SET status = 'ACTIVE' WHERE email = 'veli@demo.vipozelders.local'`);
}

test.beforeAll(async () => {
  await setLessonBooking(false);
  await cleanup();
});
test.afterAll(cleanup);

test("özel ders hesabı Pi Koç'ta öğrenci hesabı olur; koçun açtığı hesap özel derste girer; çift hesap birleşir", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  // Veli talep gönderir, öğretmen kabul eder (öğrenci öğretmenin Pi Koç'una eklenir)
  await gateLogin(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/ogretmen/ayse-yilmaz");
  const form = page.locator("aside#randevu");
  await form.getByLabel("Öğrencinin adı").fill("Tekhesap");
  await form.getByLabel("Telefonunuz").fill("05321112233");
  await form.getByLabel(/telefon numaramın öğretmenle paylaşılmasını/).check();
  await form.getByRole("button", { name: "Ders talebi gönder" }).click();
  await expect(form.getByText("Talebiniz iletildi")).toBeVisible();

  await gateLogin(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/ogretmen-paneli/ders-talepleri");
  await page.getByRole("button", { name: "Kabul et" }).first().click();
  await expect(page.getByText("Kabul ettiniz").first()).toBeVisible();
  const [{ centerStudentId }] = await sql<{ centerStudentId: string }>(`SELECT "centerStudentId" FROM "TeacherInquiry" WHERE "teacherId" = ${TEACHER} AND "requesterId" = ${PARENT}`);
  expect(centerStudentId).toBeTruthy();

  // 1. Koç sayfası: bağlı site hesabı öğrenci hesabı yapılır; şifre sıfırlama yok
  await page.goto(`/koc/ogrenciler/${centerStudentId}?sekme=bilgiler`);
  await page.getByRole("button", { name: "Bu hesabı öğrenci hesabı yap" }).click();
  await expect(page.getByText("öğrencinin sitede kendi açtığı hesap", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Şifreyi sıfırla" })).toHaveCount(0);
  const [link] = await sql<{ isStudentAccount: boolean }>(`SELECT "isStudentAccount" FROM "CenterGuardian" WHERE "studentId" = $1 AND "userId" = ${PARENT}`, [centerStudentId]);
  expect(link.isStudentAccount).toBe(true);

  // 2. Bağlantı kaldırılır (öğrencinin hesabı kapanmaz), koç yeni e-postayla hesap açar
  await page.getByRole("button", { name: "Bağlantıyı kaldır" }).click();
  await expect(page.getByRole("button", { name: "Öğrenci giriş hesabı aç" })).toBeVisible();
  const [{ status }] = await sql<{ status: string }>(`SELECT status FROM "User" WHERE email = 'veli@demo.vipozelders.local'`);
  expect(status).toBe("ACTIVE");
  await page.locator("#student-account-email").fill(NEW_EMAIL);
  await page.getByRole("button", { name: "Öğrenci giriş hesabı aç" }).click();
  await expect(page.getByText("Öğrenci giriş hesabı açıldı", { exact: false })).toBeVisible();
  const [created] = await sql<{ username: string }>(`SELECT username FROM "User" WHERE email = $1`, [NEW_EMAIL]);
  expect(created.username).toBeTruthy();

  // Koçun açtığı hesap özel ders kapısından girer (geçici şifre yerine şifreyi testte belirleriz)
  await sql(`UPDATE "User" SET "passwordHash" = (SELECT "passwordHash" FROM "User" WHERE email = 'veli@demo.vipozelders.local'), "mustChangePassword" = false WHERE email = $1`, [NEW_EMAIL]);
  await page.context().clearCookies();
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(NEW_EMAIL);
  await page.getByLabel("Şifre", { exact: true }).fill("Veli12345");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((u) => !/\/giris$/.test(u.pathname), { timeout: 30_000 });
  await expect(page.getByText("tarafında kaydınız yok", { exact: false })).toHaveCount(0);

  // 3. Yönetim çift hesabı birleştirir: koçun açtığı hesap velinin hesabına katılır
  await gateLogin(page, "admin", "Yonetici123");
  const [{ id: dupId }] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [NEW_EMAIL]);
  await page.goto(`/yonetim/ogrenciler/${dupId}`);
  await page.locator("#merge-target").fill("veli@demo.vipozelders.local");
  await page.getByRole("button", { name: "Asıl hesaba katıp bu hesabı kapat" }).click();
  // Hesap kapanınca sayfa yenilenir; birleştirme kartı gizlenir, "Hesabı aç" düğmesi görünür
  await expect(page.getByRole("button", { name: "Hesabı aç" })).toBeVisible();
  const [merged] = await sql<{ status: string }>(`SELECT status FROM "User" WHERE id = $1`, [dupId]);
  expect(merged.status).toBe("SUSPENDED");
  const [moved] = await sql<{ isStudentAccount: boolean }>(`SELECT "isStudentAccount" FROM "CenterGuardian" WHERE "studentId" = $1 AND "userId" = ${PARENT}`, [centerStudentId]);
  expect(moved.isStudentAccount).toBe(true);
});

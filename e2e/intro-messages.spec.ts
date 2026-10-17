import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Ücretsiz tanışma görüşmesi ve mesajlaşma: veli demo öğretmen ayse.yilmaz'ın profilinden 15 dk tanışma ister ve mesaj
 * gönderir (telefon numarası gizlenir) → öğretmen talebi ve mesajı görür, cevaplar. Sonunda kayıtlar geri alınır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
let startedAt: string;
let previousIntro: boolean;

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

const TEACHER = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
const PARENT = `(SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local')`;

test.beforeAll(async () => {
  [{ startedAt }] = await sql<{ startedAt: string }>(`SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS "startedAt"`);
  [{ offersIntro: previousIntro }] = await sql<{ offersIntro: boolean }>(`SELECT "offersIntro" FROM "TeacherProfile" WHERE "userId" = ${TEACHER}`);
  await sql(`UPDATE "TeacherProfile" SET "offersIntro" = true WHERE "userId" = ${TEACHER}`);
  // Önceki çalıştırmalardan kalan tanışma ve konuşma varsa temizlenir
  await sql(`DELETE FROM "Booking" WHERE "isIntro" AND "teacherId" = ${TEACHER} AND "studentId" = ${PARENT}`);
  await sql(`DELETE FROM "MessageThread" WHERE "teacherId" = ${TEACHER} AND "studentId" = ${PARENT}`);
});

test.afterAll(async () => {
  const bookings = await sql<{ id: string }>(`SELECT id FROM "Booking" WHERE "isIntro" AND "teacherId" = ${TEACHER} AND "createdAt" >= $1::timestamp`, [startedAt]);
  const threads = await sql<{ id: string }>(`SELECT id FROM "MessageThread" WHERE "teacherId" = ${TEACHER} AND "createdAt" >= $1::timestamp`, [startedAt]);
  const ids = [...bookings, ...threads].map((r) => r.id);
  await sql(`DELETE FROM "Notification" WHERE link LIKE ANY($1)`, [ids.map((id) => `%/${id}%`)]);
  await sql(`DELETE FROM "Notification" WHERE "userId" = ${TEACHER} AND type IN ('booking.request', 'message.new') AND "createdAt" >= $1::timestamp`, [startedAt]);
  await sql(`DELETE FROM "Booking" WHERE id = ANY($1)`, [bookings.map((b) => b.id)]);
  await sql(`DELETE FROM "MessageThread" WHERE id = ANY($1)`, [threads.map((t) => t.id)]);
  await sql(`UPDATE "TeacherProfile" SET "offersIntro" = $1 WHERE "userId" = ${TEACHER}`, [previousIntro]);
});

test("veli ücretsiz tanışma ister ve öğretmene mesaj gönderir; öğretmen cevaplar", async ({ page }) => {
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/ogretmen/ayse-yilmaz");
  await expect(page.getByText("Ücretsiz 15 dk tanışma görüşmesi")).toBeVisible();

  // Tanışma: 15 dk seçilir, ilk boş saat alınır
  await page.getByRole("button", { name: "15 dk tanışma · ücretsiz" }).click();
  await expect(page.getByText("Online tanışma görüşmesi")).toBeVisible();
  await page.locator('button[aria-label*="boş saat"]:not([disabled])').first().click();
  await page.locator("div.grid.grid-cols-4 button:not([disabled])").first().click();
  await page.getByRole("button", { name: "Devam et" }).click();
  await expect(page).toHaveURL(/\/rezervasyon\?.*tanisma=1/);
  await expect(page.getByText("Ücretsiz tanışma görüşmesi")).toBeVisible();
  const learner = page.getByLabel("Öğrencinin adı");
  if (await learner.isVisible()) await learner.fill("Deniz");
  await page.getByRole("button", { name: "Tanışma talebini gönder" }).click();
  await expect(page).toHaveURL(/\/hesabim\/derslerim\/[a-z0-9]+\?durum=tanisma/);
  await expect(page.getByText("Tanışma talebiniz öğretmene iletildi", { exact: false })).toBeVisible();

  // Mesaj
  await page.goto("/ogretmen/ayse-yilmaz");
  await page.getByRole("button", { name: /öğretmene mesaj gönder/ }).click();
  await page.getByLabel("Mesaj").fill("Merhaba hocam, oğlum 8. sınıf. Numaram 0532 123 45 67, dönüş yapar mısınız?");
  await page.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(page).toHaveURL(/\/hesabim\/mesajlar\/[a-z0-9]+$/);
  await expect(page.getByText("[telefon gizlendi]", { exact: false })).toBeVisible();
  await expect(page.getByText("0532 123 45 67")).toHaveCount(0);

  // Öğretmen
  await login(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/ogretmen-paneli/talepler");
  await expect(page.getByText("Ücretsiz tanışma", { exact: false }).first()).toBeVisible();
  await page.goto("/ogretmen-paneli/mesajlar");
  await page.getByRole("link", { name: /oğlum 8\. sınıf/ }).click();
  await page.getByLabel("Mesaj").fill("Merhaba, tanışma görüşmesinde seviyeye bakalım.");
  await page.getByRole("button", { name: "Gönder", exact: true }).click();
  await expect(page.getByText("tanışma görüşmesinde seviyeye bakalım", { exact: false })).toBeVisible();
});

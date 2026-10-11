import { expect, test, type Browser, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Sanal sınıf: öğretmen ve veli aynı derse girer, birbirini görür, sohbet eder; yoklama kaydedilir.
 * Çalışan bir LiveKit sunucusu ve LIVEKIT_* ayarlı geliştirme sunucusu gerektirir:
 *   E2E_LIVEKIT=1 npx playwright test classroom
 */

test.skip(!process.env.E2E_LIVEKIT, "LiveKit sunucusu gerektirir (E2E_LIVEKIT=1).");

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function loggedInPage(browser: Browser, identifier: string, password: string): Promise<Page> {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  });
  const page = await context.newPage();
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/giris/);
  return page;
}

test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });

let bookingId: string | undefined;

test.afterAll(async () => {
  if (bookingId) await sql(`DELETE FROM "Booking" WHERE id = $1`, [bookingId]);
});

test("öğretmen ve veli sanal sınıfta buluşur", async ({ browser }) => {
  const [teacher] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE username = 'ayse.yilmaz'`);
  const [parent] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local'`);
  const [offering] = await sql<{ id: string; serviceTypeId: number; levelId: number; subjectId: number }>(
    `SELECT id, "serviceTypeId", "levelId", "subjectId" FROM "TeacherOffering" WHERE "teacherId" = $1 LIMIT 1`,
    [teacher.id],
  );
  const stamp = Date.now().toString(36).toUpperCase();
  const [row] = await sql<{ id: string }>(
    `INSERT INTO "Booking" (id, code, "studentId", "teacherId", "offeringId", "serviceTypeId", "levelId", "subjectId",
       "serviceName", "levelName", "subjectName", "learnerName", mode, "startAt", "endAt", "blockEndAt", "durationMinutes",
       price, "commissionRateBps", "commissionAmount", "teacherAmount", status, "videoRoomName", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Özel Ders', 'Lise', 'Matematik', 'Ali', 'ONLINE',
       (now() at time zone 'utc') + interval '5 minutes', (now() at time zone 'utc') + interval '65 minutes', (now() at time zone 'utc') + interval '65 minutes',
       60, 90000, 1500, 13500, 76500, 'CONFIRMED', $9, now() at time zone 'utc')
     RETURNING id`,
    [`e2e_lk_${stamp}`, `VD-LK${stamp}`, parent.id, teacher.id, offering.id, offering.serviceTypeId, offering.levelId, offering.subjectId, `vd-e2e-${stamp.toLowerCase()}`],
  );
  bookingId = row.id;

  const teacherPage = await loggedInPage(browser, "ayse.yilmaz", "Ogretmen123");
  const parentPage = await loggedInPage(browser, "veli@demo.vipozelders.local", "Veli12345");

  await teacherPage.goto(`/ders/${bookingId}`);
  await parentPage.goto(`/ders/${bookingId}`);

  for (const page of [teacherPage, parentPage]) {
    await expect(page.getByText(/Dersin bitmesine \d+ dakika/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".lk-participant-tile")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Ekran paylaş/ })).toBeVisible();
  }

  // Sohbet
  await teacherPage.getByRole("button", { name: "Sohbet" }).click();
  await teacherPage.getByPlaceholder("Mesaj yazın…").fill("Merhaba Ali, hazır mısın?");
  await teacherPage.getByRole("button", { name: "Gönder" }).click();
  // Panel kapalıyken gelen mesaj kaçmaz; düğmede okunmamış sayısı görünür.
  await expect(parentPage.getByRole("button", { name: /Sohbet\s*1/ })).toBeVisible({ timeout: 15_000 });
  await parentPage.getByRole("button", { name: "Sohbet" }).click();
  await expect(parentPage.getByText("Merhaba Ali, hazır mısın?")).toBeVisible({ timeout: 15_000 });

  // Yoklama: iki taraf da kaydedildi
  await expect
    .poll(async () => (await sql<{ userId: string }>(`SELECT DISTINCT "userId" FROM "LessonAttendance" WHERE "bookingId" = $1`, [bookingId])).length)
    .toBe(2);

  // Dersten çıkış ders sayfasına döndürür
  await parentPage.getByRole("button", { name: /Dersten çık/ }).click();
  await expect(parentPage).toHaveURL(new RegExp(`/hesabim/derslerim/${bookingId}`));
});

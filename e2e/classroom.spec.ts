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

const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function loggedInPage(browser: Browser, identifier: string, password: string, device: Partial<typeof PHONE> = {}): Promise<Page> {
  const context = await browser.newContext({
    ...device,
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

// Ekran paylaşımında seçim penceresi otomatik olarak "tüm ekran" ile geçilir.
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen"] } });

const created: string[] = [];

/** Aynı öğretmenle yeni test dersi açabilmek için önceki test derslerini ve bildirimlerini siler. */
async function removeTestLessons() {
  while (created.length) {
    const id = created.pop()!;
    await sql(`DELETE FROM "Notification" WHERE link LIKE $1`, [`%/${id}%`]);
    await sql(`DELETE FROM "Booking" WHERE id = $1`, [id]);
  }
}

test.afterAll(removeTestLessons);

/** Yönetici panelden ödemesiz test dersi oluşturur ve kimliğini döndürür. */
async function createTestLesson(browser: Browser): Promise<string> {
  await removeTestLessons();
  // Elle açılmış ve hâlâ süren bir test dersi varsa (aynı saate ikinci ders açılamaz) onu kullan; silme.
  const [active] = await sql<{ id: string }>(
    `SELECT b.id FROM "Booking" b JOIN "User" u ON u.id = b."teacherId" WHERE u.username = 'ayse.yilmaz' AND b."isTest" AND b.status = 'CONFIRMED' AND b."endAt" > now() + interval '10 minutes' ORDER BY b."startAt" LIMIT 1`,
  );
  if (active) return active.id;
  const adminPage = await loggedInPage(browser, "admin", "Yonetici123");
  await adminPage.goto("/yonetim/randevular");
  await adminPage.getByText("Test dersi oluştur (görüntülü görüşme ve beyaz tahta denemesi)").click();
  const [teacher] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE username = 'ayse.yilmaz'`);
  await adminPage.locator('select[name="teacherId"]').selectOption(teacher.id);
  await adminPage.locator('input[name="studentEmail"]').fill("veli@demo.vipozelders.local");
  await adminPage.getByRole("button", { name: "Test dersini oluştur" }).click();
  await expect(adminPage).toHaveURL(/\/yonetim\/randevular\/[^/?]+\?durum=test/);
  await expect(adminPage.getByText("Test dersi oluşturuldu.", { exact: false })).toBeVisible();
  const id = new URL(adminPage.url()).pathname.split("/").pop()!;
  created.push(id);
  await adminPage.context().close();
  return id;
}

test("yönetici test dersi açar, öğretmen ve veli sanal sınıfta buluşur", async ({ browser }) => {
  const bookingId = await createTestLesson(browser);

  // Öğretmen ve veli kendi ders sayfalarından "Derse katıl" ile girer
  const teacherPage = await loggedInPage(browser, "ayse.yilmaz", "Ogretmen123");
  const parentPage = await loggedInPage(browser, "veli@demo.vipozelders.local", "Veli12345");
  await teacherPage.goto(`/ogretmen-paneli/dersler/${bookingId}`);
  await teacherPage.getByRole("link", { name: "Derse katıl" }).click();
  await parentPage.goto(`/hesabim/derslerim/${bookingId}`);
  await parentPage.getByRole("link", { name: "Derse katıl" }).click();

  for (const page of [teacherPage, parentPage]) {
    await expect(page.getByText(/Dersin bitmesine \d+ dakika/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".lk-participant-tile")).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Ekran paylaş/ })).toBeVisible();
  }

  // Ekran paylaşımı: öğretmen paylaşır, velide paylaşılan ekran büyük sahnede açılır
  await teacherPage.getByRole("button", { name: /Ekran paylaş/ }).click();
  await expect(parentPage.locator('.lk-participant-tile[data-lk-source="screen_share"]')).toBeVisible({ timeout: 20_000 });
  await expect(parentPage.getByRole("complementary", { name: "Kameralar" })).toBeVisible();
  await teacherPage.getByRole("button", { name: /Ekran paylaş/ }).click();
  await expect(parentPage.locator('.lk-participant-tile[data-lk-source="screen_share"]')).toHaveCount(0, { timeout: 20_000 });

  // Sohbet
  await teacherPage.getByRole("button", { name: "Sohbet" }).click();
  await teacherPage.getByPlaceholder("Mesaj yazın…").fill("Merhaba Ali, hazır mısın?");
  await teacherPage.getByRole("button", { name: "Gönder" }).click();
  // Panel kapalıyken gelen mesaj kaçmaz; düğmede okunmamış sayısı görünür.
  await expect(parentPage.getByRole("button", { name: /Sohbet\s*1/ })).toBeVisible({ timeout: 15_000 });
  await parentPage.getByRole("button", { name: "Sohbet" }).click();
  await expect(parentPage.getByText("Merhaba Ali, hazır mısın?")).toBeVisible({ timeout: 15_000 });

  // Beyaz tahta: öğretmen açar, velide kendiliğinden açılır; iki tarafın çizimi karşıya geçer
  await teacherPage.getByRole("button", { name: "Beyaz tahta" }).click();
  const teacherBoard = teacherPage.getByTestId("whiteboard");
  const parentBoard = parentPage.getByTestId("whiteboard");
  await expect(teacherBoard.locator(".excalidraw")).toBeVisible({ timeout: 60_000 });
  await expect(parentBoard.locator(".excalidraw")).toBeVisible({ timeout: 60_000 });

  async function drawRectangle(page: Page, offset: number) {
    await page.getByTitle(/^Dikdörtgen/).click();
    // Sol taraftaki özellik panelinin üstüne değil, tahtanın ortasına çiz.
    const box = (await page.locator("canvas.interactive").boundingBox())!;
    const x = box.x + box.width / 2 - 60 + offset;
    const y = box.y + box.height / 2 - 80 + offset / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 120, y + 80, { steps: 6 });
    await page.mouse.up();
  }
  await drawRectangle(teacherPage, 0);
  await expect(teacherBoard).toHaveAttribute("data-elements", "1");
  await expect(parentBoard).toHaveAttribute("data-elements", "1", { timeout: 15_000 });
  await drawRectangle(parentPage, 140);
  await expect(teacherBoard).toHaveAttribute("data-elements", "2", { timeout: 15_000 });
  await expect(parentBoard).toHaveAttribute("data-elements", "2");
  await teacherPage.screenshot({ path: "test-results/tahta-ogretmen.png" });

  // Yoklama: iki taraf da kaydedildi
  await expect
    .poll(async () => (await sql<{ userId: string }>(`SELECT DISTINCT "userId" FROM "LessonAttendance" WHERE "bookingId" = $1`, [bookingId])).length)
    .toBe(2);

  // Dersten çıkış ders sayfasına döndürür
  await parentPage.getByRole("button", { name: /Dersten çık/ }).click();
  await expect(parentPage).toHaveURL(new RegExp(`/hesabim/derslerim/${bookingId}`));
});

test("telefonda sınıf: tahta, kameralar ve düğmeler ekrana sığar", async ({ browser }) => {
  const bookingId = await createTestLesson(browser);
  const teacherPage = await loggedInPage(browser, "ayse.yilmaz", "Ogretmen123", PHONE);
  const parentPage = await loggedInPage(browser, "veli@demo.vipozelders.local", "Veli12345", PHONE);
  await teacherPage.goto(`/ders/${bookingId}`);
  await parentPage.goto(`/ders/${bookingId}`);
  for (const page of [teacherPage, parentPage]) {
    await expect(page.locator(".lk-participant-tile")).toHaveCount(2, { timeout: 30_000 });
  }

  // Telefonda sohbet açıkken tahta açılırsa sohbet kapanır (ikisi aynı alanı kullanır)
  await teacherPage.getByRole("button", { name: "Sohbet", exact: true }).click();
  await expect(teacherPage.getByPlaceholder("Mesaj yazın…")).toBeVisible();
  await teacherPage.getByRole("button", { name: "Beyaz tahta", exact: true }).click();
  await expect(teacherPage.getByPlaceholder("Mesaj yazın…")).toHaveCount(0);

  for (const page of [teacherPage, parentPage]) {
    await expect(page.getByTestId("whiteboard").locator(".excalidraw")).toBeVisible({ timeout: 60_000 });
    // Kameralar tahtanın altında yan yana; tüm düğmeler ekranda, yatay kaydırma yok
    const tiles = page.locator("aside[aria-label='Katılımcılar'] .lk-participant-tile");
    await expect(tiles).toHaveCount(2);
    const [first, second] = [(await tiles.nth(0).boundingBox())!, (await tiles.nth(1).boundingBox())!];
    expect(Math.abs(first.y - second.y)).toBeLessThan(2);
    const leave = (await page.getByRole("button", { name: /Dersten çık/ }).boundingBox())!;
    expect(leave.y + leave.height).toBeLessThanOrEqual(PHONE.viewport.height);
    expect(first.y + first.height).toBeLessThanOrEqual(leave.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }
  await parentPage.screenshot({ path: "test-results/tahta-telefon.png" });
});

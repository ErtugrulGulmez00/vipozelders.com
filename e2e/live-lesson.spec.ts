import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import pg from "pg";

/**
 * İki tarayıcıda uçtan uca ders: yeni bir veli kayıt olur, demo öğretmen Ayşe Yılmaz'dan ders alıp (test ödemesiyle)
 * öder; öğretmen kendi tarayıcısında talebi onaylar. Ders saati şimdiye çekilir, ikisi sanal sınıfta buluşur
 * (görüntü, sohbet, beyaz tahta, öğretmene kural hatırlatması, velinin ikinci cihazdan izleyici girişi).
 * Ders bitince otomatik tamamlanır, öğretmenin hakedişi oluşur, veli değerlendirme yapar.
 * Çalışan LiveKit ve test ödemesine izin veren sunucu gerektirir: E2E_LIVEKIT=1 npx playwright test live-lesson
 */

test.skip(!process.env.E2E_LIVEKIT, "LiveKit sunucusu gerektirir (E2E_LIVEKIT=1).");
test.use({ launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] } });
test.setTimeout(240_000);

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const email = `canli.${stamp}@test.local`;
const learner = `Canlı${stamp}`;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function newContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ permissions: ["camera", "microphone"], locale: "tr-TR", timezoneId: "Europe/Istanbul", viewport: { width: 1280, height: 860 } });
}

async function login(page: Page, identifier: string, password: string) {
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).not.toHaveURL(/\/giris/);
}

let teacherStats: { ratingAvg: number; ratingCount: number; completedLessons: number };

test.beforeAll(async () => {
  [teacherStats] = await sql(`SELECT "ratingAvg", "ratingCount", "completedLessons" FROM "TeacherProfile" WHERE "userId" = (SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`);
});

test.afterAll(async () => {
  const bookings = await sql<{ id: string }>(`SELECT b.id FROM "Booking" b JOIN "User" u ON u.id = b."studentId" WHERE u.email = $1`, [email]);
  const ids = bookings.map((b) => b.id);
  await sql(`DELETE FROM "LedgerEntry" WHERE "bookingId" = ANY($1)`, [ids]);
  await sql(`DELETE FROM "Notification" WHERE link LIKE ANY($1)`, [ids.map((id) => `%/${id}%`)]);
  await sql(`DELETE FROM "Booking" WHERE id = ANY($1)`, [ids]);
  await sql(`DELETE FROM "User" WHERE email = $1`, [email]);
  // Değerlendirme ve ders sayısı geri alınır (demo öğretmenin istatistikleri değişmesin)
  await sql(`UPDATE "TeacherProfile" SET "ratingAvg" = $1, "ratingCount" = $2, "completedLessons" = $3 WHERE "userId" = (SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`, [teacherStats.ratingAvg, teacherStats.ratingCount, teacherStats.completedLessons]);
});

test("iki tarayıcı: veli kayıt olur, ders alır; öğretmen onaylar; canlı derste buluşurlar; ders tamamlanır", async ({ browser }) => {
  const studentCtx = await newContext(browser);
  const teacherCtx = await newContext(browser);
  const student = await studentCtx.newPage();
  const teacher = await teacherCtx.newPage();

  // --- Öğretmen tarayıcısı: giriş yapıp panelde bekler
  await login(teacher, "ayse.yilmaz", "Ogretmen123");
  await expect(teacher.getByText("Ders, ödeme ve yazışmalar yalnızca Pi Kampüs üzerinden.")).toBeVisible();

  // --- Veli tarayıcısı: kayıt
  await student.goto("/kayit");
  await student.getByLabel("Ad", { exact: true }).fill("Canlı");
  await student.getByLabel("Soyad", { exact: true }).fill(`Veli${stamp}`);
  await student.getByLabel("E-posta", { exact: true }).fill(email);
  await student.getByLabel("Şifre", { exact: true }).fill("Veli12345");
  await student.getByLabel(/KVKK Aydınlatma Metni/).check();
  await student.getByLabel(/Kullanım Şartları/).check();
  await student.getByRole("button", { name: "Hesabımı oluştur" }).click();
  await expect(student).toHaveURL(/\/hesabim$/);

  // Öğretmeni bulur, saat seçer (aynı gün kapalı: ilk boş gün yarın ya da sonrası)
  await student.goto("/ogretmen/ayse-yilmaz");
  await expect(student.getByRole("heading", { name: "Randevu al" })).toBeVisible();
  await student.getByRole("button", { name: "1 saat" }).click();
  const slot = student.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}$/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();
  await student.getByRole("button", { name: "Devam et" }).click();

  // Rezervasyon ve test ödemesi
  await expect(student).toHaveURL(/\/rezervasyon\?/);
  await student.getByLabel("Öğrencinin adı").fill(learner);
  await student.getByLabel(/Ön Bilgilendirme Formu/).check();
  await student.getByRole("button", { name: "Ödemeye geç" }).click();
  await expect(student).toHaveURL(/\/odeme\/test\//);
  await student.getByRole("button", { name: /başarılı test/ }).click();
  await expect(student.getByRole("heading", { name: "Ödemeniz alındı" })).toBeVisible();
  const [booking] = await sql<{ id: string; code: string; status: string; startAt: Date }>(`SELECT b.id, b.code, b.status, b."startAt" FROM "Booking" b JOIN "User" u ON u.id = b."studentId" WHERE u.email = $1`, [email]);
  expect(booking.status).toBe("PENDING_APPROVAL");
  expect(booking.startAt.getTime()).toBeGreaterThan(Date.now() + 2 * 3_600_000);

  // --- Öğretmen tarayıcısı: talep anlık bildirilir ve onaylanır
  await teacher.goto("/ogretmen-paneli/talepler");
  const request = teacher.locator("li, article, div.rounded-3xl").filter({ hasText: learner }).filter({ has: teacher.getByRole("button", { name: "Onayla" }) }).last();
  await expect(request).toBeVisible();
  await request.getByRole("button", { name: "Onayla" }).click();
  await expect(teacher.getByText("Ders onaylandı; öğrenciye bildirildi.")).toBeVisible();

  // --- Veli tarayıcısı: onay görünür
  await student.goto(`/hesabim/derslerim/${booking.id}`);
  await expect(student.getByText("Onaylandı", { exact: true }).first()).toBeVisible();

  // Ders saatini şimdiye çek (sınıf dersten 10 dk önce açılır)
  await sql(
    `UPDATE "Booking" SET "startAt" = now() at time zone 'utc' - interval '1 minute', "endAt" = now() at time zone 'utc' + interval '59 minutes', "blockEndAt" = now() at time zone 'utc' + interval '59 minutes' WHERE id = $1`,
    [booking.id],
  );

  // --- Canlı ders: ikisi de "Derse katıl"
  await teacher.goto(`/ogretmen-paneli/dersler/${booking.id}`);
  await teacher.getByRole("link", { name: "Derse katıl" }).click();
  await student.reload();
  await expect(student.getByRole("link", { name: "Veli olarak izle" })).toBeVisible();
  await student.getByRole("link", { name: "Derse katıl" }).click();
  for (const page of [teacher, student]) {
    await expect(page.getByText(/Dersin bitmesine \d+ dakika/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".lk-participant-tile")).toHaveCount(2, { timeout: 30_000 });
  }
  await expect(teacher.getByText(/Hatırlatma:.*platform dışına yönlendirmek yasaktır/)).toBeVisible();
  await expect(student.getByText(/Hatırlatma:/)).toHaveCount(0);

  // Velinin ikinci cihazı izleyici olarak girer: görünmez, sınıfta hâlâ 2 kişi
  const observerCtx = await newContext(browser);
  const observer = await observerCtx.newPage();
  await login(observer, email, "Veli12345");
  await observer.goto(`/ders/${booking.id}?izle=1`);
  await expect(observer.getByText("İzleyici modundasınız", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(observer.locator(".lk-participant-tile")).toHaveCount(2, { timeout: 30_000 });
  await expect(observer.getByRole("button", { name: /Mikrofon/ })).toHaveCount(0);
  await teacher.waitForTimeout(2000);
  await expect(teacher.locator(".lk-participant-tile")).toHaveCount(2);

  // Sohbet
  await teacher.getByRole("button", { name: "Sohbet" }).click();
  await teacher.getByPlaceholder("Mesaj yazın…").fill(`Merhaba ${learner}, başlayalım mı?`);
  await teacher.getByRole("button", { name: "Gönder" }).click();
  await expect(student.getByRole("button", { name: /Sohbet\s*1/ })).toBeVisible({ timeout: 15_000 });
  await student.getByRole("button", { name: "Sohbet" }).click();
  await expect(student.getByText(`Merhaba ${learner}, başlayalım mı?`)).toBeVisible();

  // Beyaz tahta: öğretmen çizer, velide görünür
  await teacher.getByRole("button", { name: "Beyaz tahta" }).click();
  const teacherBoard = teacher.getByTestId("whiteboard");
  const studentBoard = student.getByTestId("whiteboard");
  await expect(teacherBoard.locator(".excalidraw")).toBeVisible({ timeout: 60_000 });
  await expect(studentBoard.locator(".excalidraw")).toBeVisible({ timeout: 60_000 });
  await teacher.getByTitle(/^Dikdörtgen/).click();
  const box = (await teacher.locator("canvas.interactive").boundingBox())!;
  await teacher.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 40);
  await teacher.mouse.down();
  await teacher.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40, { steps: 6 });
  await teacher.mouse.up();
  await expect(studentBoard).toHaveAttribute("data-elements", "1", { timeout: 15_000 });
  await teacher.screenshot({ path: "test-results/canli-ders-ogretmen.png" });
  await student.screenshot({ path: "test-results/canli-ders-veli.png" });

  // Yoklama iki tarafı da kaydetti (izleyici sayılmaz)
  await expect.poll(async () => (await sql<{ userId: string }>(`SELECT DISTINCT "userId" FROM "LessonAttendance" WHERE "bookingId" = $1`, [booking.id])).length).toBe(2);

  // Dersten çıkış
  await student.getByRole("button", { name: /Dersten çık/ }).click();
  await expect(student).toHaveURL(new RegExp(`/hesabim/derslerim/${booking.id}`));
  await teacher.getByRole("button", { name: /Dersten çık/ }).click();
  await observerCtx.close();

  // Ders bitti: zamanı geriye al, sunucunun dakikalık görevi dersi tamamlar
  await sql(
    `UPDATE "Booking" SET "startAt" = now() at time zone 'utc' - interval '61 minutes', "endAt" = now() at time zone 'utc' - interval '1 minute', "blockEndAt" = now() at time zone 'utc' - interval '1 minute' WHERE id = $1`,
    [booking.id],
  );
  await expect.poll(async () => (await sql<{ status: string }>(`SELECT status FROM "Booking" WHERE id = $1`, [booking.id]))[0].status, { timeout: 120_000, intervals: [5_000] }).toBe("COMPLETED");
  const [ledger] = await sql<{ amount: number }>(`SELECT COALESCE(SUM(amount), 0)::int AS amount FROM "LedgerEntry" WHERE "bookingId" = $1 AND bucket = 'PENDING'`, [booking.id]);
  expect(ledger.amount).toBeGreaterThan(0);

  // --- Öğretmen tarayıcısı: ders tamamlandı, hakediş beklemede
  await teacher.goto("/ogretmen-paneli/kazanclar");
  // Masaüstünde tablo görünür (telefon listesi gizli)
  await expect(teacher.getByRole("table").getByText(booking.code, { exact: false }).first()).toBeVisible();

  // --- Veli tarayıcısı: değerlendirme
  await student.goto(`/hesabim/derslerim/${booking.id}`);
  await student.getByRole("button", { name: "5 yıldız" }).click();
  await student.getByLabel("Yorumunuz (isteğe bağlı)").fill("Canlı derste tahta ve sohbet sorunsuz çalıştı.");
  await student.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(student.getByText("Değerlendirmeniz için teşekkürler!")).toBeVisible();

  await studentCtx.close();
  await teacherCtx.close();
});

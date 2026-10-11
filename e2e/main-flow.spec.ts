import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Ana senaryo: yönetici öğretmen ekler → öğretmen geçici şifreyle girip şifresini değiştirir,
 * profil/ders/takvim girer → yönetici yayına alır → veli kayıt olur, öğretmeni bulur, saat seçip
 * (test) ödeme yapar → öğretmen onaylar → ders tamamlanır → veli değerlendirir.
 * Test kendi oluşturduğu kayıtları sonunda siler.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const teacherLastName = `Deneme${stamp}`;
const studentEmail = `e2e-${stamp}@example.com`;
const created: { teacherId?: string; studentEmail?: string } = {};

// 1x1 piksel PNG (fotoğraf yükleme testi için)
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

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
  // Giriş işlemi oturum çerezini yazıp yönlendirene kadar bekle.
  await expect(page).not.toHaveURL(/\/giris/);
}

test.afterAll(async () => {
  if (created.teacherId) {
    await sql(`DELETE FROM "Booking" WHERE "teacherId" = $1`, [created.teacherId]);
    await sql(`DELETE FROM "User" WHERE id = $1`, [created.teacherId]);
  }
  if (created.studentEmail) await sql(`DELETE FROM "User" WHERE email = $1`, [created.studentEmail]);
});

test("öğretmen ekleme → yayın → rezervasyon ve ödeme → onay → tamamlama → değerlendirme", async ({ page }) => {
  // 1) Yönetici hızlı öğretmen ekler
  await login(page, "admin", "Yonetici123");
  await expect(page).toHaveURL(/\/yonetim$/);
  await page.goto("/yonetim/ogretmenler/yeni");
  await page.getByLabel("Ad", { exact: true }).fill("Test");
  await page.getByLabel("Soyad", { exact: true }).fill(teacherLastName);
  await page.getByRole("button", { name: "Öğretmeni ekle ve giriş bilgisi üret" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const temporaryPassword = (await page.getByTestId("new-password").innerText()).trim();
  const href = await page.getByRole("link", { name: "Profilini doldur" }).getAttribute("href");
  created.teacherId = href!.split("/").pop()!;
  expect(username).toBe(`test.deneme${stamp}`);

  // 2) Öğretmen geçici şifreyle girer, şifre değiştirmeye zorlanır
  await login(page, username, temporaryPassword);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(temporaryPassword);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("YeniSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("YeniSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/ogretmen-paneli$/);

  // 3) Profil (fotoğraf yükleme dahil)
  await page.goto("/ogretmen-paneli/profil");
  await page.getByLabel("Kısa başlık").fill("Uçtan uca test matematik öğretmeni");
  await page.getByLabel("Hakkımda").fill("Matematik öğretmeniyim. Öğrencilerimle konu anlatımı ve bol soru çözümüyle çalışıyor, her dersten sonra veliye kısa bir özet gönderiyorum.");
  await page.locator('input[name="photo"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel(/Devlet okulunda kadrolu/).check();
  await page.getByRole("button", { name: "Profili kaydet" }).click();
  await expect(page.getByText("Profil kaydedildi.")).toBeVisible();
  const photoSrc = await page.locator(`img[alt="Test ${teacherLastName}"]`).first().getAttribute("src");
  expect(photoSrc).toMatch(/^\/api\/dosya\/public\/ogretmen\//);
  expect((await page.request.get(photoSrc!)).status()).toBe(200);

  // 4) Ders ve fiyat
  await page.goto("/ogretmen-paneli/dersler-ve-fiyatlar");
  const levelId = (await sql<{ id: number }>(`SELECT id FROM "Level" WHERE slug = 'lise'`))[0].id;
  await page.locator('select[name="levelId"]').selectOption(String(levelId));
  await page.locator('select[name="subjectId"]').selectOption({ label: "Matematik" });
  await page.locator('input[name="hourlyPrice"]').fill("800");
  await expect(page.getByText("Sizin kazancınız")).toBeVisible();
  await page.getByRole("button", { name: "Dersi ekle" }).click();
  await expect(page.getByText("Ders ve fiyat kaydedildi.")).toBeVisible();

  // 5) Haftalık takvim: her gün 17:00-21:00
  await page.goto("/ogretmen-paneli/takvim");
  const addButtons = page.getByRole("button", { name: "Aralık", exact: true });
  for (let i = 0; i < 7; i++) await addButtons.nth(i).click();
  await page.getByRole("button", { name: "Takvimi kaydet" }).click();
  await expect(page.getByText("Haftalık takviminiz kaydedildi.")).toBeVisible();

  // 6) Yönetici yayına alır
  await login(page, "admin", "Yonetici123");
  await page.goto(`/yonetim/ogretmenler/${created.teacherId}`);
  await page.getByRole("button", { name: "Yayına al" }).click();
  await expect(page.getByText("Öğretmen yayına alındı.")).toBeVisible();

  // 7) Veli kayıt olur
  await page.context().clearCookies();
  await page.goto("/kayit");
  await page.getByLabel("Ad", { exact: true }).fill("Ece");
  await page.getByLabel("Soyad", { exact: true }).fill("Testoğlu");
  await page.getByLabel("E-posta", { exact: true }).fill(studentEmail);
  await page.getByLabel("Şifre", { exact: true }).fill("Veli12345");
  await page.getByLabel(/KVKK Aydınlatma Metni/).check();
  await page.getByLabel(/Kullanım Şartları/).check();
  await page.getByRole("button", { name: "Hesabımı oluştur" }).click();
  created.studentEmail = studentEmail;
  await expect(page).toHaveURL(/\/hesabim$/);

  // 8) Öğretmeni bulur ve saat seçer
  await page.goto(`/ogretmenler?q=${encodeURIComponent(teacherLastName)}`);
  await page.getByRole("link", { name: /Test D\./ }).click();
  await expect(page.getByRole("heading", { name: "Randevu al" })).toBeVisible();
  const slot = page.locator("button:not([disabled])", { hasText: /^\d{2}:\d{2}$/ }).first();
  await expect(slot).toBeVisible();
  await slot.click();
  await page.getByRole("button", { name: "Devam et" }).click();

  // 9) Rezervasyon formu ve test ödemesi
  await expect(page).toHaveURL(/\/rezervasyon\?/);
  await page.getByLabel("Öğrencinin adı").fill("Deniz");
  await page.getByLabel(/Ön Bilgilendirme Formu/).check();
  await page.getByRole("button", { name: "Ödemeye geç" }).click();
  await expect(page).toHaveURL(/\/odeme\/test\//);
  await page.getByRole("button", { name: /başarılı test/ }).click();
  await expect(page.getByRole("heading", { name: "Ödemeniz alındı" })).toBeVisible();

  // Saat artık başkasına dolu görünür
  const [booking] = await sql<{ id: string; status: string; startAt: Date }>(`SELECT id, status, "startAt" FROM "Booking" WHERE "teacherId" = $1`, [created.teacherId]);
  expect(booking.status).toBe("PENDING_APPROVAL");

  // 10) Öğretmen onaylar
  await login(page, username, "YeniSifre123");
  await page.goto("/ogretmen-paneli/talepler");
  await expect(page.getByText("Deniz", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Onayla" }).click();
  await expect(page).toHaveURL(new RegExp(`/ogretmen-paneli/dersler/${booking.id}\\?durum=onaylandi`));
  await expect(page.getByText("Ders onaylandı; öğrenciye bildirildi.")).toBeVisible();
  await expect(page.getByText("Onaylandı", { exact: true })).toBeVisible();

  // 11) Ders bitmiş gibi zamanı geriye al, yönetici görevleri çalıştırsın
  await sql(`UPDATE "Booking" SET "startAt" = now() at time zone 'utc' - interval '2 hours', "endAt" = now() at time zone 'utc' - interval '1 hour', "blockEndAt" = now() at time zone 'utc' - interval '1 hour' WHERE id = $1`, [booking.id]);
  await login(page, "admin", "Yonetici123");
  await page.getByRole("button", { name: "Zamanlanmış görevleri şimdi çalıştır" }).click();
  await expect(page.getByText(/Görevler çalıştı|başka bir süreçte/)).toBeVisible();
  await expect.poll(async () => (await sql<{ status: string }>(`SELECT status FROM "Booking" WHERE id = $1`, [booking.id]))[0].status, { timeout: 90_000 }).toBe("COMPLETED");

  // 12) Veli değerlendirir; puan profil sayfasına yansır
  await login(page, studentEmail, "Veli12345");
  await page.goto(`/hesabim/derslerim/${booking.id}`);
  await page.getByRole("button", { name: "5 yıldız" }).click();
  await page.getByLabel("Yorumunuz (isteğe bağlı)").fill("Çok verimli bir ders oldu, teşekkürler.");
  await page.getByRole("button", { name: "Değerlendirmeyi gönder" }).click();
  await expect(page.getByText("Değerlendirmeniz için teşekkürler!")).toBeVisible();
  const [teacher] = await sql<{ ratingAvg: number; ratingCount: number; completedLessons: number }>(`SELECT "ratingAvg", "ratingCount", "completedLessons" FROM "TeacherProfile" WHERE "userId" = $1`, [created.teacherId]);
  expect(teacher).toMatchObject({ ratingAvg: 5, ratingCount: 1, completedLessons: 1 });
});

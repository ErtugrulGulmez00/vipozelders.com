import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Soru kredisi + soru havuzu: veli /soru-sor sayfasından 10 kredilik paketi (test ödemesiyle) alır, sorunun
 * fotoğrafını gönderir → demo öğretmen ayse.yilmaz havuzdan soruyu üstlenip çözer → veli çözümü görür, puanlar.
 * Öğretmen geçici olarak "onaylı" yapılır; sonunda tüm kayıtlar geri alınır.
 * Sunucu test ödemesine izin vermeli (geliştirme ortamı ya da ALLOW_TEST_PAYMENTS=true).
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
// Veritabanı saatiyle (UTC, saat dilimsiz) karşılaştırılır; temizlik yalnızca bu testin kayıtlarını siler.
let startedAt: string;

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

let previousVerification: string;
let pair: { levelId: number; subjectId: number };

test.beforeAll(async () => {
  [{ startedAt }] = await sql<{ startedAt: string }>(`SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.MS') AS "startedAt"`);
  const [teacher] = await sql<{ verificationStatus: string; levelId: number; subjectId: number }>(
    `SELECT t."verificationStatus", o."levelId", o."subjectId" FROM "TeacherProfile" t JOIN "User" u ON u.id = t."userId"
     JOIN "TeacherOffering" o ON o."teacherId" = t."userId" AND o."isActive" WHERE u.username = 'ayse.yilmaz' ORDER BY o."createdAt" LIMIT 1`,
  );
  previousVerification = teacher.verificationStatus;
  pair = { levelId: teacher.levelId, subjectId: teacher.subjectId };
  await sql(`UPDATE "TeacherProfile" SET "verificationStatus" = 'VERIFIED', "answersPool" = true WHERE "userId" = (SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`);
});

test.afterAll(async () => {
  const purchases = await sql<{ id: string }>(
    `SELECT p.id FROM "CreditPurchase" p JOIN "User" u ON u.id = p."studentId" WHERE u.email = 'veli@demo.vipozelders.local' AND p."createdAt" >= $1::timestamp`,
    [startedAt],
  );
  const purchaseIds = purchases.map((p) => p.id);
  const questions = await sql<{ id: string }>(`SELECT id FROM "PoolQuestion" WHERE "purchaseId" = ANY($1)`, [purchaseIds]);
  const questionIds = questions.map((q) => q.id);
  await sql(`DELETE FROM "LedgerEntry" WHERE "poolQuestionId" = ANY($1)`, [questionIds]);
  await sql(`DELETE FROM "Notification" WHERE link LIKE ANY($1) OR (type LIKE 'credits.%' AND "createdAt" >= $2::timestamp)`, [questionIds.map((id) => `%/${id}%`), startedAt]);
  await sql(`DELETE FROM "CreditPurchase" WHERE id = ANY($1)`, [purchaseIds]);
  await sql(`UPDATE "TeacherProfile" SET "verificationStatus" = $1 WHERE "userId" = (SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`, [previousVerification]);
});

test("veli kredi alır, soru gönderir; öğretmen havuzdan üstlenip çözer", async ({ page }) => {
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/soru-sor");
  await expect(page.getByRole("heading", { name: "Kredi paketleri" })).toBeVisible();
  await page.getByText("10 soru", { exact: true }).click();
  await page.getByLabel(/okudum ve onaylıyorum/).check();
  await page.getByRole("button", { name: "Ödemeye geç" }).click();

  await expect(page).toHaveURL(/\/odeme\/test\//);
  await expect(page.getByText("10 soru kredisi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /öde \(başarılı test\)/ }).click();
  await expect(page.getByRole("heading", { name: "Kredileriniz hesabınızda" })).toBeVisible();

  await page.getByRole("link", { name: "Soru sor" }).last().click();
  await expect(page.getByRole("heading", { name: "Soru gönder" })).toBeVisible();
  await page.getByLabel("Kademe ve ders").selectOption(`${pair.levelId}:${pair.subjectId}`);
  await page.locator('input[name="image"]').setInputFiles({ name: "soru.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Not (isteğe bağlı)").fill("İkinci adımda takıldım, beni 0532 123 45 67 numarasından arayın");
  await page.getByRole("button", { name: /Soruyu gönder/ }).click();

  await expect(page).toHaveURL(/\/hesabim\/sorularim\/[a-z0-9]+$/);
  await expect(page.getByText("Sorunuz öğretmen bekliyor")).toBeVisible();
  await expect(page.getByText("0532 123 45 67")).toHaveCount(0);
  const questionUrl = page.url();
  const questionId = questionUrl.split("/").pop()!;

  // Öğretmen
  await login(page, "ayse.yilmaz", "Ogretmen123");
  await page.goto("/ogretmen-paneli/soru-havuzu");
  await expect(page.getByRole("heading", { name: "Havuzdaki sorular" })).toBeVisible();
  await page.goto(`/ogretmen-paneli/soru-havuzu/${questionId}`);
  await expect(page.getByAltText("Soru fotoğrafı")).toBeVisible();
  // Öğrencinin adı öğretmene gösterilmez
  const [student] = await sql<{ lastName: string }>(`SELECT "lastName" FROM "User" WHERE email = 'veli@demo.vipozelders.local'`);
  await expect(page.locator("main")).not.toContainText(student.lastName);
  await page.getByRole("button", { name: "Üstlen ve çöz" }).click();
  await expect(page.getByText(/Soru sizde:/)).toBeVisible();
  await page.getByLabel("Çözüm", { exact: true }).fill("Önce iki tarafı 2 ile çarpıyoruz, sonra x'i yalnız bırakıyoruz: x = 4. Kontrol için yerine koyalım.");
  await page.getByRole("button", { name: "Çözümü gönder" }).click();
  await expect(page.getByText("Çözümünüz öğrenciye gönderildi.", { exact: false })).toBeVisible();

  // Veli çözümü görür ve puanlar
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto(questionUrl);
  await expect(page.getByText("Öğretmenin çözümü")).toBeVisible();
  await page.getByRole("radio", { name: "5 puan" }).click();
  await page.getByRole("button", { name: "Puanla" }).click();
  await expect(page.getByText("Teşekkürler, puanınız kaydedildi.")).toBeVisible();
  await page.getByLabel("Anlamadığınız yeri sorun (bir kez)").fill("Neden 2 ile çarptık?");
  await page.getByRole("button", { name: "Ek soruyu gönder" }).click();
  await expect(page.getByText("Öğretmenin cevabı bekleniyor", { exact: false })).toBeVisible();

  await page.goto("/hesabim/krediler");
  await expect(page.getByText("Kalan krediniz: 9.", { exact: false })).toBeVisible();
});

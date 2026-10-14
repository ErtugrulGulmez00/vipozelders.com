import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Kaynak/kitap takibi ve çalışma programı: kurum kaynak ekler ve sınıfa atar → öğrenci kartında programa madde ekler,
 * konu ilerlemesi girer → veli portalda programı görür, "Yaptım" işaretler, kaynak ilerlemesini görür.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const resourceName = `E2e Soru Bankası ${stamp}`;

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

test.afterAll(async () => {
  await sql(`DELETE FROM "CenterStudyPlanItem" WHERE note = $1`, [`e2e ${stamp}`]);
  await sql(`DELETE FROM "CenterResource" WHERE name = $1`, [resourceName]);
});

test("kaynak atanır, program yazılır, veli işaretler", async ({ page }) => {
  const [ali] = await sql<{ id: string }>(`SELECT s.id FROM "CenterStudent" s JOIN "Center" c ON c.id = s."centerId" WHERE c.slug = 'basari-etut-merkezi' AND s."firstName" = 'Ali' AND s."lastName" = 'Demirtaş'`);

  // Kurum: kaynak ekle ve sınıfa ata
  await login(page, "kurum@demo.vipozelders.local", "Kurum12345");
  await page.goto("/kurum/kaynaklar");
  await page.getByLabel("Kaynak adı").fill(resourceName);
  await page.getByLabel("Ders", { exact: true }).fill("Matematik");
  await page.getByLabel("Konular / üniteler").fill("Çarpanlar ve Katlar\nÜslü İfadeler\nKareköklü İfadeler");
  await page.getByRole("button", { name: "Kaynağı ekle" }).click();
  await expect(page.getByText("Kaynak eklendi", { exact: false })).toBeVisible();
  await page.getByLabel("Kime").selectOption({ label: "8-A LGS (tüm sınıf)" });
  await page.getByRole("button", { name: "Kaynağı ata" }).click();
  await expect(page.getByText(/Kaynak \d+ öğrenciye atandı/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ali Demirtaş" })).toBeVisible();

  // Öğrenci kartı: programa madde + konu ilerlemesi
  await page.goto(`/kurum/ogrenciler/${ali.id}?sekme=program`);
  await page.getByLabel("Kaynak (isteğe bağlı)").selectOption({ label: `Matematik · ${resourceName}` });
  await page.getByLabel("Konu (isteğe bağlı)").fill("Üslü İfadeler");
  await page.getByLabel("Hedef soru (isteğe bağlı)").fill("40");
  await page.getByLabel("Not (isteğe bağlı)").fill(`e2e ${stamp}`);
  await page.getByRole("button", { name: "Programa ekle" }).click();
  await expect(page.getByText("Programa eklendi.")).toBeVisible();
  const card = page.locator("div.rounded-2xl", { hasText: resourceName }).last();
  await card.getByText("İlerleme gir").click();
  await card.getByLabel("Çarpanlar ve Katlar doğru").fill("18");
  await card.getByLabel("Çarpanlar ve Katlar yanlış").fill("2");
  await card.getByLabel("Çarpanlar ve Katlar bitti").check();
  await card.getByRole("button", { name: "İlerlemeyi kaydet" }).click();
  await expect(page.getByText("İlerleme kaydedildi.")).toBeVisible();
  await expect(card.getByText("1/3 konu bitti", { exact: false })).toBeVisible();
  await expect(card.getByText("Çarpanlar ve Katlar %90")).toBeVisible();

  // Veli: çalışma programı sekmesi
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/hesabim/kurum");
  await page.getByRole("link", { name: /Ali Demirtaş/ }).click();
  await page.getByRole("link", { name: "Çalışma programı" }).click();
  const item = page.locator("li", { hasText: `e2e ${stamp}` });
  await expect(item.getByText("Üslü İfadeler", { exact: false })).toBeVisible();
  await item.getByRole("button", { name: "Tamamlandı işaretle" }).click();
  await expect(item.getByRole("button", { name: "Tamamlanmadı yap" })).toBeVisible();
  await expect(page.getByText(resourceName, { exact: false }).first()).toBeVisible();
  const [done] = await sql<{ doneAt: Date | null }>(`SELECT "doneAt" FROM "CenterStudyPlanItem" WHERE note = $1`, [`e2e ${stamp}`]);
  expect(done.doneAt).not.toBeNull();
});

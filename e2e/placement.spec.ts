import { expect, test } from "@playwright/test";
import pg from "pg";
import { gateLogin } from "./gate-login";

/**
 * Tercih robotu ve yapay zekâ asistanı (kurum paneli): test kendi program verisini (ileri bir yıl) ekler, robot en son
 * yılı kullandığı için bu veriyle çalışır; sonunda siler. Öğrenciye YKS listesi hazırlanır, sıra değişir, çıkarılır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const YEAR = 2091;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

const programs = [
  ["E2ETIP", "E2e Tıp", 520, 2_000],
  ["E2EBIL", "E2e Bilgisayar Mühendisliği", 470, 40_000],
  ["E2EMAT", "E2e Matematik", 360, 80_000],
  ["E2EUZAK", "E2e Uzak Program", 250, 900_000],
] as const;

test.beforeAll(async () => {
  for (const [code, name, score, rank] of programs) {
    await sql(
      `INSERT INTO "PlacementProgram" (id, exam, year, code, name, institution, city, "scoreType", kind, quota, "minScore", "minRank")
       VALUES ($1, 'YKS', $2, $3, $4, 'E2e Üniversitesi', 'ANKARA', 'SAY', 'Devlet', 50, $5, $6) ON CONFLICT DO NOTHING`,
      [`e2e_${code}`, YEAR, code, name, score, rank],
    );
  }
});

test.afterAll(async () => {
  await sql(`DELETE FROM "CenterPlacementList" WHERE $1 = ANY("programIds") OR $2 = ANY("programIds")`, ["e2e_E2EBIL", "e2e_E2EMAT"]);
  await sql(`DELETE FROM "PlacementProgram" WHERE year = $1`, [YEAR]);
});

test("kurum: YKS tercih robotu öğrenciye liste hazırlar; asistan öneri yazar", async ({ page }) => {
  test.setTimeout(150_000);
  const [student] = await sql<{ id: string; firstName: string }>(
    `SELECT s.id, s."firstName" FROM "CenterStudent" s JOIN "CenterMember" m ON m."centerId" = s."centerId" JOIN "User" u ON u.id = m."userId"
     WHERE u.email = 'kurum@demo.vipozelders.local' AND s.status = 'ACTIVE' ORDER BY s."createdAt" LIMIT 1`,
  );
  await sql(`DELETE FROM "CenterPlacementList" WHERE "studentId" = $1 AND exam = 'YKS'`, [student.id]);
  await gateLogin(page, "kurum@demo.vipozelders.local", "Kurum12345");

  await page.getByRole("navigation").first().getByRole("link", { name: "YKS tercih robotu" }).click();
  await expect(page).toHaveURL(/\/kurum\/yks-tercih$/);
  await expect(page.getByText("Puan ya da başarı sırası girin")).toBeVisible();

  // Başarı sırası 60.000: Tıp (2.000. sıra) elenir; bilgisayar (40.000) hayal tercihi, matematik ve uzak program güvenli
  await page.getByLabel("Öğrenci (listeye eklemek için)").selectOption(student.id);
  await page.getByLabel("Başarı sırası").fill("60.000");
  await page.getByRole("button", { name: "Programları bul" }).click();
  await expect(page).toHaveURL(/sira=60.000/);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("E2e Bilgisayar Mühendisliği");
  await expect(rows.nth(0)).toContainText("Hayal tercihi");
  await expect(rows.nth(1)).toContainText("Güvenli");
  await expect(rows.nth(2)).toContainText("E2e Uzak Program");
  await expect(page.getByText("E2e Tıp")).toHaveCount(0);

  // İkisini listeye ekle, sırayı değiştir, birini çıkar
  await rows.nth(0).getByRole("button", { name: "Tercih listesine ekle" }).click();
  await expect(rows.nth(0)).toContainText("Listede");
  await rows.nth(1).getByRole("button", { name: "Tercih listesine ekle" }).click();
  await expect(rows.nth(1)).toContainText("Listede");
  const list = page.locator("ol li");
  await expect(list).toHaveCount(2);
  await expect(page.getByText("2 / 24 tercih")).toBeVisible();
  await list.nth(1).getByRole("button", { name: "Yukarı taşı" }).click();
  await expect(list.nth(0)).toContainText("E2e Matematik");
  await list.nth(1).getByRole("button", { name: "Listeden çıkar" }).click();
  await expect(list).toHaveCount(1);
  const [saved] = await sql<{ programIds: string[]; rank: number }>(`SELECT "programIds", rank FROM "CenterPlacementList" WHERE "studentId" = $1 AND exam = 'YKS'`, [student.id]);
  expect(saved).toMatchObject({ programIds: ["e2e_E2EMAT"], rank: 60000 });

  // Öğrenci seçilince son puan hatırlanır
  await page.goto(`/kurum/yks-tercih?ogrenci=${student.id}`);
  await expect(page.getByLabel("Başarı sırası")).toHaveValue("60000");

  // Yapay zekâ asistanı (yapay zekâ yanıt vermezse kurallı öneri döner)
  await page.goto(`/kurum/ogrenciler/${student.id}?sekme=asistan`);
  await page.getByRole("button", { name: /Yol haritası/ }).click();
  await expect(page.getByTestId("assistant-result")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("assistant-result")).toContainText(/\S{10,}/);
});

import { expect, test } from "@playwright/test";
import pg from "pg";
import { gateLogin } from "./gate-login";

/**
 * Pi Koç: kaynak eklerken hazır MEB konu listesi, kitap okuma takibi ve başlangıç–son net karşılaştırması.
 * Geçici bir koç hesabı ve öğrenci kurulur; iki TYT denemesi SQL ile eklenir. Sonunda silinir.
 */

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

test("Pi Koç: hazır konu listesi, kitap okuma ve başlangıç–son net", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (d) => d.accept());
  const centerId = `e2e_kitap_${Date.now()}`;
  const studentId = `${centerId}_s`;
  const [owner] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = 'kurum@demo.vipozelders.local'`);
  await sql(`INSERT INTO "Center" (id, name, slug, kind, status, "studentLimit", "updatedAt") VALUES ($1, 'E2e Kitap Koçu', $1, 'COACH', 'TRIAL', 5, now())`, [centerId]);
  await sql(`INSERT INTO "CenterMember" (id, "centerId", "userId", role) VALUES ($1, $2, $3, 'OWNER')`, [`${centerId}_m`, centerId, owner.id]);
  await sql(`INSERT INTO "CenterStudent" (id, "centerId", "firstName", "lastName", "updatedAt") VALUES ($1, $2, 'Kitap', 'Okur', now())`, [studentId, centerId]);
  // İki TYT denemesi: ilkinde Türkçe 20 / Matematik 10, sonrakinde Türkçe 25 / Matematik 18
  for (const [n, date, tr, mat] of [["1", "2026-09-10", 20, 10], ["2", "2026-11-01", 25, 18]] as const) {
    const exam = `${centerId}_e${n}`;
    await sql(`INSERT INTO "CenterExam" (id, "centerId", name, kind, date, "wrongPenalty") VALUES ($1, $2, $3, 'TYT', $4::date, 0.25)`, [exam, centerId, `Deneme ${n}`, date]);
    await sql(`INSERT INTO "CenterExamSection" (id, "examId", name, "questionCount", "order") VALUES ($1, $2, 'Türkçe', 40, 0), ($3, $2, 'Matematik', 40, 1)`, [`${exam}_tr`, exam, `${exam}_mat`]);
    await sql(`INSERT INTO "CenterExamResult" (id, "examId", "studentId", correct, wrong, blank, net) VALUES ($1, $2, $3, 0, 0, 0, $4)`, [`${exam}_r`, exam, studentId, tr + mat]);
    await sql(
      `INSERT INTO "CenterExamSectionResult" (id, "resultId", "sectionId", correct, wrong, blank, net) VALUES ($1, $2, $3, 0, 0, 0, $4), ($5, $2, $6, 0, 0, 0, $7)`,
      [`${exam}_r_tr`, `${exam}_r`, `${exam}_tr`, tr, `${exam}_r_mat`, `${exam}_mat`, mat],
    );
  }
  try {
    await gateLogin(page, "kurum@demo.vipozelders.local", "Kurum12345");
    await page.goto("/panel-sec?taraf=koc");
    await expect(page).toHaveURL(/\/koc/);

    // Hazır konu listesi (MEB Maarif)
    await page.goto("/koc/kaynaklar");
    await page.getByText("Hazır listeden doldur", { exact: false }).first().click();
    // 5. sınıf Matematik (MEB Maarif)
    await page.getByLabel("Hazır konu listesi").selectOption("maarif-5-ortaokul-matematik-dersi");
    await expect(page.getByText("bu yıl okutulan program", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Konuları kutuya yaz" }).click();
    await expect(page.locator('textarea[name="topics"]')).not.toHaveValue("");

    // Başlangıç–son net
    await page.goto(`/koc/ogrenciler/${studentId}?sekme=denemeler`);
    await expect(page.getByText("başlangıçtan bugüne", { exact: false })).toBeVisible();
    await expect(page.getByText("+13", { exact: true })).toBeVisible();
    await expect(page.getByText("+8", { exact: true })).toBeVisible();

    // Kitap okuma
    await page.goto(`/koc/ogrenciler/${studentId}?sekme=kitaplar`);
    await page.getByRole("button", { name: "+ Kitap ekle" }).click();
    await page.locator("#reading-title").fill("Küçük Prens");
    await page.locator("#reading-author").fill("Antoine de Saint-Exupéry");
    await page.locator("#reading-pages").fill("120");
    await page.getByRole("button", { name: "Kitabı ekle" }).click();
    await expect(page.getByText("Küçük Prens")).toBeVisible();
    await page.locator('input[name="pagesRead"]').first().fill("60");
    await page.getByRole("button", { name: "Kaydet" }).first().click();
    await expect(page.getByText("60/120")).toBeVisible();
    await page.getByRole("button", { name: "Bitirdi" }).click();
    await expect(page.getByText("Bitenler")).toBeVisible();
    const [book] = await sql<{ pagesRead: number; finished: boolean }>(`SELECT "pagesRead", "finishedOn" IS NOT NULL AS finished FROM "CenterReadingBook" WHERE "studentId" = $1`, [studentId]);
    expect(book).toEqual({ pagesRead: 120, finished: true });
  } finally {
    await sql(`DELETE FROM "Center" WHERE id = $1`, [centerId]);
  }
});

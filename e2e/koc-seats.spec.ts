import { expect, test } from "@playwright/test";
import pg from "pg";
import { gateLogin } from "./gate-login";

/**
 * Pi Koç koltuk kuralı: arşive alınan öğrenci 30 gün tekrar aktif edilemez; son 30 günde arşive alınanlar da sayılır
 * (5'lik pakette en fazla 7 farklı öğrenci). Geçici bir koç hesabı kurulur, sonunda silinir.
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

test("Pi Koç: arşivle-yenisini ekle döngüsü paket sınırını aşamaz", async ({ page }) => {
  test.setTimeout(120_000);
  const centerId = `e2e_seat_${Date.now()}`;
  const [owner] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = 'kurum@demo.vipozelders.local'`);
  // Ücretli sayılan (bitişi olmayan deneme) 5 öğrencilik geçici Pi Koç hesabı
  await sql(`INSERT INTO "Center" (id, name, slug, kind, status, "studentLimit", "updatedAt") VALUES ($1, 'E2e Koltuk Koçu', $1, 'COACH', 'TRIAL', 5, now())`, [centerId]);
  await sql(`INSERT INTO "CenterMember" (id, "centerId", "userId", role) VALUES ($1, $2, $3, 'OWNER')`, [`${centerId}_m`, centerId, owner.id]);
  const add = (n: string, status: string, archivedDaysAgo: number | null) =>
    sql(
      `INSERT INTO "CenterStudent" (id, "centerId", "firstName", "lastName", status, "archivedAt", "createdAt", "updatedAt")
       VALUES ($1, $2, 'Koltuk', $3, $4::"CenterStudentStatus", CASE WHEN $5::int IS NULL THEN NULL ELSE now() - make_interval(days => $5::int) END, now() - interval '40 days', now())`,
      [`${centerId}_${n}`, centerId, n, status, archivedDaysAgo],
    );
  for (const n of ["A", "B", "C", "D"]) await add(n, "ACTIVE", null);
  await add("E", "PASSIVE", 7);
  try {
    await gateLogin(page, "kurum@demo.vipozelders.local", "Kurum12345");
    await page.goto("/panel-sec?taraf=koc");
    await expect(page).toHaveURL(/\/koc/);

    // 7 gün önce arşive alınan öğrenci geri açılamaz
    await page.goto(`/koc/ogrenciler/${centerId}_E?sekme=bilgiler`);
    await page.getByRole("button", { name: /Yeniden aktif yap/ }).click();
    await expect(page.getByText("30 gün dolmadan tekrar aktif edilemez", { exact: false })).toBeVisible();

    // 4 aktif + 3 yakında arşivlenen = 7: yeni öğrenci eklenemez
    await add("F", "PASSIVE", 3);
    await add("G", "PASSIVE", 1);
    await page.goto("/koc/ogrenciler/yeni");
    await page.getByLabel("Ad", { exact: true }).fill("Yeni");
    await page.getByLabel("Soyad", { exact: true }).fill("Öğrenci");
    await page.getByRole("button", { name: "Öğrenciyi ekle" }).click();
    await expect(page.getByText("en fazla 7 farklı öğrenci", { exact: false })).toBeVisible();
    const [{ n }] = await sql<{ n: string }>(`SELECT count(*) n FROM "CenterStudent" WHERE "centerId" = $1`, [centerId]);
    expect(Number(n)).toBe(7);
  } finally {
    await sql(`DELETE FROM "Center" WHERE id = $1`, [centerId]);
  }
});

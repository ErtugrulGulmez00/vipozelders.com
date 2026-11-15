import { gateLogin } from "./gate-login";
import { expect, test } from "@playwright/test";
import pg from "pg";

/**
 * Bildir ve engelle: öğretmen veliyle olan konuşmada veliyi bildirir ve engeller → yönetimde bildirim görünür,
 * iki tarafta da yazma kutusu kapanır; engel kaldırılınca açılır. Sonunda kayıtlar silinir.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const TEACHER = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
const PARENT = `(SELECT id FROM "User" WHERE email = 'veli@demo.vipozelders.local')`;
const THREAD_ID = "e2e-safety-thread";

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

async function cleanup() {
  await sql(`DELETE FROM "ContentReport" WHERE "refId" = $1`, [THREAD_ID]);
  await sql(`DELETE FROM "UserBlock" WHERE "blockerId" = ${TEACHER} AND "blockedId" = ${PARENT}`);
  await sql(`DELETE FROM "Notification" WHERE link LIKE '%/yonetim/sikayetler%' OR link LIKE $1`, [`%${THREAD_ID}%`]);
  await sql(`DELETE FROM "MessageThread" WHERE id = $1 OR ("teacherId" = ${TEACHER} AND "studentId" = ${PARENT})`, [THREAD_ID]);
}

test.beforeAll(async () => {
  await cleanup();
  await sql(`INSERT INTO "MessageThread" (id, "studentId", "teacherId", "lastMessageAt") VALUES ($1, ${PARENT}, ${TEACHER}, now())`, [THREAD_ID]);
  await sql(`INSERT INTO "DirectMessage" (id, "threadId", "authorId", body) VALUES ('e2e-safety-msg', $1, ${PARENT}, 'Merhaba hocam, matematik dersi için yazıyorum.')`, [THREAD_ID]);
});

test.afterAll(cleanup);

test("öğretmen veliyi bildirir ve engeller; konuşma iki tarafta kapanır", async ({ browser }) => {
  const teacher = await browser.newPage();
  await gateLogin(teacher, "ayse.yilmaz", "Ogretmen123");
  await teacher.goto(`/ogretmen-paneli/mesajlar/${THREAD_ID}`);
  await expect(teacher.getByText("matematik dersi için yazıyorum")).toBeVisible();

  // Bildir
  await teacher.getByRole("button", { name: "Bildir" }).click();
  await teacher.getByLabel("Bildirim nedeni").selectOption("taciz");
  await teacher.getByLabel("Açıklama").fill("E2E deneme bildirimi");
  await teacher.getByRole("button", { name: "Bildirimi gönder" }).click();
  await expect(teacher.getByText("Bildiriminiz alındı", { exact: false })).toBeVisible();
  const [report] = await sql<{ reason: string; kind: string }>(`SELECT reason, kind FROM "ContentReport" WHERE "refId" = $1`, [THREAD_ID]);
  expect(report).toEqual({ reason: "taciz", kind: "thread" });

  // Engelle
  await teacher.getByRole("button", { name: "Engelle", exact: true }).click();
  await teacher.locator("form").getByRole("button", { name: "Engelle", exact: true }).click();
  await expect(teacher.getByText("Bu kişiyi engellediniz", { exact: false })).toBeVisible();
  await expect(teacher.getByLabel("Mesaj")).toHaveCount(0);

  // Veli tarafında yazma kutusu kapalı
  const parent = await browser.newPage();
  await gateLogin(parent, "veli@demo.vipozelders.local", "Veli12345");
  await parent.goto(`/hesabim/mesajlar/${THREAD_ID}`);
  await expect(parent.getByText("Bu konuşmaya artık mesaj gönderilemiyor.")).toBeVisible();
  await expect(parent.getByLabel("Mesaj")).toHaveCount(0);

  // Yönetim bildirimi görür
  const admin = await browser.newPage();
  await gateLogin(admin, "admin", "Yonetici123");
  await admin.goto("/yonetim/sikayetler");
  await expect(admin.getByText("E2E deneme bildirimi")).toBeVisible();

  // Engel kaldırılınca yazma kutusu geri gelir
  // Engelleme formu açık kalır; düğmesi artık "Engeli kaldır"
  await teacher.locator("form").getByRole("button", { name: "Engeli kaldır" }).click();
  await expect(teacher.getByLabel("Mesaj")).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Kurum paneli ek modülleri (demo kurum "Başarı Etüt Merkezi"): üst çubukta öğrenci arama, koçluk ataması ve
 * görüşme, sınıf defteri, çalışma salonu, optik okuyucu ve kelebek düzeni; veli portalında görünüm.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);

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

function istanbulToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}
function istanbulWeekday(): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 1;
}

let ali: { id: string; studentNumber: string; groupId: string };

test.beforeAll(async () => {
  [ali] = await sql<{ id: string; studentNumber: string; groupId: string }>(
    `SELECT s.id, s."studentNumber", gs."groupId" FROM "CenterStudent" s JOIN "Center" c ON c.id = s."centerId" JOIN "CenterGroupStudent" gs ON gs."studentId" = s.id
     WHERE c.slug = 'basari-etut-merkezi' AND s."firstName" = 'Ali' AND s."lastName" = 'Demirtaş' LIMIT 1`,
  );
});

test.afterAll(async () => {
  await sql(`DELETE FROM "CenterCoachingSession" WHERE notes LIKE $1`, [`%${stamp}%`]);
  await sql(`UPDATE "CenterStudent" SET "coachId" = NULL, "coachWeekday" = NULL, "coachMinute" = NULL WHERE id = $1`, [ali.id]);
  await sql(`DELETE FROM "CenterStudyHall" WHERE name = $1`, [`E2e salon ${stamp}`]);
  await sql(`DELETE FROM "CenterOpticTemplate" WHERE name = $1`, [`E2e optik ${stamp}`]);
  await sql(`DELETE FROM "CenterAttendanceSession" WHERE subject = $1`, [`E2e ders ${stamp}`]);
  await sql(`DELETE FROM "Notification" WHERE body LIKE $1`, ["%çalışma salonu%"]);
});

test("öğrenci arama, koçluk, sınıf defteri, salon ve veli portalı", async ({ page }) => {
  await login(page, "kurum@demo.vipozelders.local", "Kurum12345");

  // Üst çubuk araması tek sonuçta doğrudan öğrenci kartını açar
  await page.goto("/kurum");
  await page.getByRole("searchbox", { name: "Öğrenci ara" }).fill("Ali Demirtaş");
  await page.getByRole("searchbox", { name: "Öğrenci ara" }).press("Enter");
  await expect(page).toHaveURL(new RegExp(`/kurum/ogrenciler/${ali.id}`));

  // Koç ataması: Ali'ye kurum sahibi koç, bugün 18:00
  await page.goto("/kurum/kocluk?atama=1");
  await page.getByRole("textbox", { name: "Öğrenci ara" }).fill("Ali Demirtaş");
  await page.getByLabel("Ali Demirtaş koçu").selectOption({ index: 1 });
  await page.getByLabel("Ali Demirtaş görüşme günü").selectOption(String(istanbulWeekday()));
  await page.getByLabel("Ali Demirtaş görüşme saati").fill("18:00");
  await page.getByRole("button", { name: "Atamaları kaydet" }).click();
  await expect(page.getByText("koç ve görüşme saati kaydedildi", { exact: false })).toBeVisible();
  const [coach] = await sql<{ coachId: string }>(`SELECT "coachId" FROM "CenterStudent" WHERE id = $1`, [ali.id]);
  const [owner] = await sql<{ id: string }>(`SELECT m.id FROM "CenterMember" m JOIN "User" u ON u.id = m."userId" WHERE u.email = 'kurum@demo.vipozelders.local'`);
  if (coach.coachId !== owner.id) await sql(`UPDATE "CenterStudent" SET "coachId" = $1 WHERE id = $2`, [owner.id, ali.id]);
  await page.goto("/kurum/kocluk");
  await expect(page.getByRole("link", { name: /Ali Demirtaş/ }).first()).toBeVisible();

  // Görüşme kaydı (veli görsün)
  await page.goto(`/kurum/ogrenciler/${ali.id}?sekme=kocluk`);
  await page.getByLabel("Görüşme notu", { exact: true }).fill(`Deneme netleri yükseliyor ${stamp}`);
  await page.getByLabel("Öncelikli konular").fill("Üslü ifadeler, Paragraf");
  await page.getByLabel("Bu görüşme notu veli portalında görünsün").check();
  await page.getByRole("button", { name: "Görüşmeyi kaydet" }).click();
  await expect(page.getByText("Görüşme kaydedildi.")).toBeVisible();
  await expect(page.getByText(`Deneme netleri yükseliyor ${stamp}`)).toBeVisible();

  // Sınıf defteri: yoklamada işlenen konu
  await page.goto(`/kurum/yoklama/al?grup=${ali.groupId}&tarih=${istanbulToday()}&saat=07:00&bitis=07:40&konu=${encodeURIComponent(`E2e ders ${stamp}`)}`);
  await page.getByLabel(/Sınıf defteri/).fill(`Kareköklü ifadeler ${stamp}`);
  await page.getByRole("button", { name: "Yoklamayı kaydet" }).click();
  await expect(page.getByText("Yoklama kaydedildi", { exact: false })).toBeVisible();
  await page.goto(`/kurum/sinif-defteri?grup=${ali.groupId}`);
  await expect(page.getByText(`Kareköklü ifadeler ${stamp}`)).toBeVisible();

  // Çalışma salonu: salon aç, 8-A'yı ekle, Ali 1. periyot geldi
  await page.goto("/kurum/calisma-salonu");
  await page.getByLabel("Salon adı").fill(`E2e salon ${stamp}`);
  await page.getByLabel("Periyotlar").fill("09:00-09:45\n10:00-10:45");
  await page.getByRole("button", { name: "Salonu ekle" }).click();
  await expect(page.getByText("Salon eklendi", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Öğrenciler ve ayarlar" }).click();
  await page.getByLabel("Kimleri ekleyelim?").selectOption({ label: "8-A LGS (tüm sınıf)" });
  await page.getByRole("button", { name: "Salona ekle" }).click();
  await expect(page.getByText(/öğrenci salona eklendi/)).toBeVisible();
  await page.getByRole("link", { name: "Günlük yoklama" }).click();
  await page.getByRole("button", { name: "Ali Demirtaş 1. periyot: —" }).click();
  await page.getByRole("button", { name: "Salon yoklamasını kaydet" }).click();
  await expect(page.getByText("salon yoklaması kaydedildi", { exact: false })).toBeVisible();
  const [day] = await sql<{ marks: string }>(`SELECT d.marks FROM "CenterHallDay" d JOIN "CenterStudyHall" h ON h.id = d."hallId" WHERE h.name = $1 AND d."studentId" = $2`, [`E2e salon ${stamp}`, ali.id]);
  expect(day.marks).toBe("G-");

  // Veli portalı: koç notu, salon, işlenen konu
  await login(page, "veli@demo.vipozelders.local", "Veli12345");
  await page.goto("/hesabim/kurum");
  await page.getByRole("link", { name: /Ali Demirtaş/ }).click();
  await page.getByRole("link", { name: "Çalışma programı" }).click();
  await expect(page.getByText(`Deneme netleri yükseliyor ${stamp}`)).toBeVisible();
  await page.getByRole("link", { name: "Devam ve etüt" }).click();
  await expect(page.getByText(`İşlenen: Kareköklü ifadeler ${stamp}`)).toBeVisible();
  await expect(page.getByText(`E2e salon ${stamp}`, { exact: false })).toBeVisible();
});

test("optik okuyucu dosyası ve kelebek düzeni", async ({ page }) => {
  const [exam] = await sql<{ id: string }>(`SELECT e.id FROM "CenterExam" e JOIN "Center" c ON c.id = e."centerId" WHERE c.slug = 'basari-etut-merkezi' AND e.name = 'LGS Kurum Denemesi 3'`);
  const sections = await sql<{ questionCount: number; answerKey: string | null }>(`SELECT "questionCount", "answerKey" FROM "CenterExamSection" WHERE "examId" = $1 ORDER BY "order"`, [exam.id]);
  await login(page, "kurum@demo.vipozelders.local", "Kurum12345");
  await page.goto(`/kurum/denemeler/${exam.id}/ice-aktar`);

  // Şablon: numara 1-6, cevaplar 7'den itibaren ders ders bitişik
  let pos = 7;
  const positions = sections.map((s) => {
    const p = `${pos}:${s.questionCount}`;
    pos += s.questionCount;
    return p;
  });
  await page.getByLabel("Şablon adı").last().fill(`E2e optik ${stamp}`);
  await page.getByLabel("Numara uzunluğu").last().fill("6");
  await page.getByLabel("Ders cevaplarının konumu").last().fill(positions.join("\n"));
  await page.getByRole("button", { name: "Şablon ekle" }).click();
  await expect(page.getByText("Optik şablon kaydedildi.")).toBeVisible();

  // Ali tüm soruları anahtarla aynı işaretler: tam net
  const line = ali.studentNumber.padStart(6, "0") + sections.map((s) => (s.answerKey ? s.answerKey.replace(/X/g, "A") : " ".repeat(s.questionCount))).join("");
  await page.getByLabel("Optik şablon").selectOption({ label: `E2e optik ${stamp}` });
  await page.locator('input[name="file"][accept*=".txt"]').setInputFiles({ name: "optik.txt", mimeType: "text/plain", buffer: Buffer.from(`${line}\r\n999999${"A".repeat(10)}\r\n`) });
  await page.getByRole("button", { name: "Formları oku" }).click();
  await expect(page.getByText("1 öğrencinin optik formu okundu.")).toBeVisible();
  // Anahtarı olan derslerde (optikle okunanlar) yanlış ve boş yok
  const keyed = await sql<{ wrong: number; blank: number; answers: string | null }>(
    `SELECT sr.wrong, sr.blank, sr.answers FROM "CenterExamSectionResult" sr JOIN "CenterExamResult" r ON r.id = sr."resultId" JOIN "CenterExamSection" s ON s.id = sr."sectionId"
     WHERE r."examId" = $1 AND r."studentId" = $2 AND s."answerKey" IS NOT NULL`,
    [exam.id, ali.id],
  );
  expect(keyed.length).toBeGreaterThan(0);
  expect(keyed.every((k) => k.wrong === 0 && k.blank === 0 && k.answers)).toBe(true);

  // Kelebek: 8-A ve 8-B iki salona
  const groups = await sql<{ id: string }>(`SELECT g.id FROM "CenterGroup" g JOIN "Center" c ON c.id = g."centerId" WHERE c.slug = 'basari-etut-merkezi' AND g.name IN ('8-A LGS', '8-B LGS')`);
  await page.goto(`/kurum/denemeler/${exam.id}/kelebek?salonlar=${encodeURIComponent("A salonu: 12\nB salonu: 12")}&${groups.map((g) => `grup=${g.id}`).join("&")}`);
  await expect(page.getByRole("heading", { name: /A salonu/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /B salonu/ })).toBeVisible();
});

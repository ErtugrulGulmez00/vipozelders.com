import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Pi Koç: tanıtım sayfası ve başvuru; yönetici "Bireysel koç" türünde hesap açar → koç ilk girişte şifresini belirler,
 * kendi paneline (/koc) düşer: öğrenci ekler, soru ve deneme girer, grafikleri görür; kurum paneli adresleri /koc'a döner.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const centerName = `E2e Koç ${stamp}`;
const ownerEmail = `e2e-koc-${stamp}@example.com`;
const applicantEmail = `e2e-koc-basvuru-${stamp}@example.com`;
const studentEmail = `e2e-koc-ogrenci-${stamp}@example.com`;

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
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = ANY($1)`, [[ownerEmail, studentEmail, applicantEmail]]);
  const ids = users.map((u) => u.id);
  await sql(`DELETE FROM "Center" WHERE name = ANY($1)`, [[centerName, `${centerName} Kayıt`]]);
  await sql(`DELETE FROM "LoginAttempt" WHERE identifier LIKE 'koc-signup:%'`);
  await sql(`DELETE FROM "Notification" WHERE "userId" = ANY($1)`, [ids]);
  await sql(`DELETE FROM "AuditLog" WHERE "actorId" = ANY($1) OR "entityId" = ANY($1) OR details::text LIKE $2`, [ids, `%${centerName}%`]);
  await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [ids]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = ANY($1)`, [[ownerEmail, applicantEmail, studentEmail]]);
  await sql(`DELETE FROM "CenterApplication" WHERE email = $1`, [applicantEmail]);
  await sql(`DELETE FROM "Notification" WHERE type = 'center.application' AND body LIKE $1`, [`%${centerName}%`]);
});

test("Pi Koç sayfası fiyatları gösterir; koç kendi kaydolur, deneme hemen başlar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Koç musunuz/ }).click();
  await expect(page).toHaveURL(/\/pi-koc$/);
  await expect(page.getByRole("heading", { level: 1, name: /Öğrencilerinizi tek panelden/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bu paketle ücretsiz başla" })).toHaveCount(6);
  await expect(page.getByText("₺299", { exact: false })).toBeVisible();

  await page.getByRole("link", { name: "Bu paketle ücretsiz başla" }).nth(2).click();
  await expect(page).toHaveURL(/\/pi-koc\/kayit\?ogrenci=10$/);
  // Önceki sayfa (aynı formu içerir) gizli olarak DOM'da kalabilir; temiz yükle
  await page.reload();
  await expect(page.locator("#ks-students")).toHaveValue("10");
  await page.getByLabel("Ad", { exact: true }).fill("Deniz");
  await page.getByLabel("Soyad", { exact: true }).fill("Kayıt");
  await page.getByLabel("E-posta").fill(applicantEmail);
  await page.getByLabel("Cep telefonu").fill("05321234567");
  await page.locator("#ks-password").fill("KocKayit123");
  await page.locator("#ks-panel").fill(`${centerName} Kayıt`);
  await page.locator('input[name="kvkk"]').check();
  await page.getByRole("button", { name: /gün ücretsiz başla/ }).click();
  await expect(page).toHaveURL(/\/koc\?durum=hosgeldin$/);
  await expect(page.getByText("Pi Koç hesabınız hazır", { exact: false })).toBeVisible();
  const [center] = await sql<{ kind: string; status: string; studentLimit: number }>(`SELECT kind::text, status::text, "studentLimit" FROM "Center" WHERE name = $1`, [`${centerName} Kayıt`]);
  expect(center).toMatchObject({ kind: "COACH", status: "TRIAL", studentLimit: 10 });

  // Aynı e-postayla ikinci kayıt reddedilir
  await page.context().clearCookies();
  await page.goto("/pi-koc/kayit");
  await page.getByLabel("Ad", { exact: true }).fill("Deniz");
  await page.getByLabel("Soyad", { exact: true }).fill("Kayıt");
  await page.getByLabel("E-posta").fill(applicantEmail);
  await page.getByLabel("Cep telefonu").fill("05321234567");
  await page.locator("#ks-password").fill("KocKayit123");
  await page.locator('input[name="kvkk"]').check();
  await page.getByRole("button", { name: /gün ücretsiz başla/ }).click();
  await expect(page.getByText("Bu e-postayla Pi Kampüs hesabı var", { exact: false }).first()).toBeVisible();
});

test("yönetici koç hesabı açar; koç yalnızca takip bölümlerini görür", async ({ page }) => {
  test.setTimeout(120_000);
  await login(page, "admin", "Yonetici123");
  await page.goto("/yonetim/kurumlar");
  const form = page.locator("form", { has: page.getByRole("button", { name: "Kurumu aç" }) });
  await form.getByLabel("Kurum adı").fill(centerName);
  await form.getByLabel("Tür").selectOption("COACH");
  await form.getByLabel("Pi Koç öğrenci sınırı").fill("5");
  await form.getByLabel("Ad", { exact: true }).fill("Deniz");
  await form.getByLabel("Soyad").fill("Koç");
  await form.getByLabel("E-posta", { exact: true }).fill(ownerEmail);
  await form.getByRole("button", { name: "Kurumu aç" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();
  const [center] = await sql<{ kind: string; studentLimit: number; disabledModules: string[] }>(`SELECT kind::text, "studentLimit", "disabledModules" FROM "Center" WHERE name = $1`, [centerName]);
  expect(center).toMatchObject({ kind: "COACH", studentLimit: 5 });
  expect(center.disabledModules).toContain("etutler");

  await login(page, username, password);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("KocSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("KocSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  // Koç kurum paneline değil kendi paneline (Pi Koç) düşer
  await expect(page).toHaveURL(/\/koc$/);
  const nav = page.getByRole("navigation").first();
  for (const label of ["Genel bakış", "Öğrencilerim", "Haftalık görüşmeler", "Kaynak kütüphanesi", "Hesap ve abonelik"]) await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();

  // Kurum paneli adresleri Pi Koç'a döner
  for (const path of ["/kurum", "/kurum/siniflar", "/kurum/ogrenciler"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/koc$/);
  }

  // Öğrenci ekle → öğrenci sayfası
  await page.goto("/koc/ogrenciler/yeni");
  await page.getByLabel("Ad", { exact: true }).fill("Elif");
  await page.getByLabel("Soyad", { exact: true }).fill(`Koç${stamp}`);
  await page.locator("select[name=gradeName]").selectOption("12. sınıf");
  await page.locator("select[name=targetExam]").selectOption("YKS (Sayısal)");
  await page.locator("select[name=coachWeekday]").selectOption("2");
  await page.getByLabel("Saat", { exact: true }).fill("18:30");
  await page.getByRole("button", { name: "Öğrenciyi ekle" }).click();
  await expect(page).toHaveURL(/\/koc\/ogrenciler\/c[a-z0-9]+\?durum=eklendi$/);
  await expect(page.getByRole("heading", { name: `Elif Koç${stamp}` })).toBeVisible();
  const studentUrl = page.url().split("?")[0];

  // Soru takibi; doğru + yanlış çözülenden fazla olamaz
  await page.goto(`${studentUrl}?sekme=sorular`);
  await page.locator("input[name=subject]").fill("Matematik");
  await page.locator("input[name=solved]").fill("40");
  await page.locator("input[name=correct]").fill("30");
  await page.locator("input[name=wrong]").fill("6");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByText("Soru kaydı eklendi.")).toBeVisible();
  await page.locator("input[name=subject]").fill("Fizik");
  await page.locator("input[name=solved]").fill("10");
  await page.locator("input[name=correct]").fill("9");
  await page.locator("input[name=wrong]").fill("5");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByText("Doğru + yanlış, çözülen sorudan fazla olamaz.")).toBeVisible();

  // Deneme sonucu (TYT): Türkçe 30 doğru 8 yanlış → 28 net
  await page.goto(`${studentUrl}?sekme=denemeler`);
  await page.locator("select[name=kind]").selectOption("TYT");
  await page.locator("input[name=name]").fill("E2e TYT 1");
  await page.getByLabel("Türkçe doğru").fill("30");
  await page.getByLabel("Türkçe yanlış").fill("8");
  await page.getByRole("button", { name: "Sonucu kaydet" }).click();
  await expect(page.getByText("Deneme sonucu kaydedildi.")).toBeVisible();
  const [exam] = await sql<{ net: number }>(`SELECT r.net FROM "CenterExamResult" r JOIN "CenterExam" e ON e.id = r."examId" JOIN "Center" c ON c.id = e."centerId" WHERE e.name = 'E2e TYT 1' AND c.name = $1`, [centerName]);
  expect(Number(exam.net)).toBe(28);

  // Genel bakış: göstergeler ve grafikler
  await page.goto(studentUrl);
  await expect(page.getByText("Son TYT neti")).toBeVisible();
  await expect(page.getByText("Son denemede dersler")).toBeVisible();
  await page.goto("/koc");
  await expect(page.getByRole("link", { name: new RegExp(`Elif Koç${stamp}`) }).first()).toBeVisible();
  await page.goto("/koc/abonelik");
  await expect(page.getByText("Pi Koç · 5 öğrenciye kadar")).toBeVisible();

  // Öğrenci girişi: koç hesap açar, bugüne bir görev yazar
  const studentId = studentUrl.split("/").pop()!;
  const [coachCenter] = await sql<{ id: string }>(`SELECT id FROM "Center" WHERE name = $1`, [centerName]);
  await sql(`INSERT INTO "CenterStudyPlanItem" (id, "centerId", "studentId", date, subject, topic, "createdAt") VALUES ($1, $2, $3, (now() AT TIME ZONE 'Europe/Istanbul')::date, 'Matematik', $4, now())`, [`e2e-plan-${stamp}`, coachCenter.id, studentId, `Türev ${stamp}`]);
  await page.goto(`${studentUrl}?sekme=bilgiler`);
  await page.getByLabel("Öğrencinin e-postası").fill(studentEmail);
  await page.getByRole("button", { name: "Öğrenci giriş hesabı aç" }).click();
  await expect(page.getByText("Öğrenci giriş hesabı açıldı.")).toBeVisible();
  const studentUsername = (await page.getByTestId("new-username").innerText()).trim();
  const studentPassword = (await page.getByTestId("new-password").innerText()).trim();

  // Öğrenci Pi Koç kapısından girer, şifresini belirler; kendi koçluk ekranına (/kocum) düşer
  await page.context().clearCookies();
  await page.goto("/kocum");
  await expect(page).toHaveURL(/\/koc-giris$/);
  await page.goto("/koc-giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill(studentUsername);
  await page.getByLabel("Şifre", { exact: true }).fill(studentPassword);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(studentPassword);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("OgrenciSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("OgrenciSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/kocum\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Merhaba Elif" })).toBeVisible();
  const kocumUrl = page.url();

  // Bugünkü görevi işaretler, soru girer
  await expect(page.getByText(`Türev ${stamp}`)).toBeVisible();
  await page.getByRole("button", { name: "Tamamlandı işaretle" }).click();
  await expect(page.getByRole("button", { name: "Tamamlanmadı yap" })).toBeVisible();
  await page.locator("input[name=subject]").fill("Geometri");
  await page.locator("input[name=solved]").fill("25");
  await page.locator("input[name=correct]").fill("20");
  await page.locator("input[name=wrong]").fill("3");
  await page.getByRole("button", { name: "Ekle", exact: true }).click();
  await expect(page.getByText("Kaydedildi. Koçun görecek.")).toBeVisible();
  const [log] = await sql<{ byStudent: boolean; solved: number }>(`SELECT "byStudent", solved FROM "CenterQuestionLog" WHERE "studentId" = $1 AND subject = 'Geometri'`, [studentId]);
  expect(log).toMatchObject({ byStudent: true, solved: 25 });

  // Koç paneli öğrenciye açılmaz; kurum portalında Pi Koç kaydı listelenmez, eski adres /kocum'a döner
  await page.goto("/koc");
  await expect(page).not.toHaveURL(/\/koc$/);
  await page.goto(kocumUrl.replace("/kocum/", "/hesabim/kurum/"));
  await expect(page).toHaveURL(kocumUrl);
  // Pi Koç girişindeki oturum açık kişi doğrudan ekranına geçer
  await page.goto("/koc-giris");
  await expect(page).toHaveURL(kocumUrl);

  // Koç, öğrencinin girdiği kaydı işaretli görür
  await login(page, username, "KocSifre123");
  await page.goto(`${studentUrl}?sekme=sorular`);
  await expect(page.getByText("Öğrenci girdi")).toBeVisible();

  // Hedef: TYT Türkçe 34 net → son denemede 28 net, 6 net kaldı
  await page.goto(studentUrl);
  await page.locator("select[name=kind]").selectOption("TYT");
  await page.locator("input[name=label]").fill("İTÜ Bilgisayar");
  await page.getByLabel("Türkçe hedef net").fill("34");
  await page.getByRole("button", { name: "Hedefi kaydet" }).click();
  // Kayıttan sonra boş form yerini hedef kartına bırakır
  await expect(page.getByText("Hedefe 6 net kaldı")).toBeVisible();
  await expect(page.getByText("İTÜ Bilgisayar", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Net gelişimi" })).toHaveCount(0); // tek deneme: grafik yerine bilgi

  // Haftalık rapor: değerlendirme yazılır; veli bağlantıyı giriş yapmadan açar
  await page.getByRole("link", { name: "Haftalık rapor" }).click();
  await expect(page).toHaveURL(/\/rapor$/);
  await page.locator("textarea[name=note]").fill(`Harika bir hafta ${stamp}`);
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Değerlendirme kaydedildi.")).toBeVisible();
  await expect(page.getByText(`Harika bir hafta ${stamp}`).first()).toBeVisible();
  const [report] = await sql<{ token: string }>(`SELECT token FROM "CenterWeeklyReport" WHERE "studentId" = $1`, [studentId]);
  // Velinin e-postası yok: otomatik gönderim açıkça reddedilir
  await page.getByRole("button", { name: "Velilere gönder" }).click();
  await expect(page.getByText("Velinin e-posta adresi kayıtlı değil", { exact: false })).toBeVisible();
  await page.context().clearCookies();
  await page.goto(`/rapor/${report.token}`);
  await expect(page.getByRole("heading", { name: `Elif Koç${stamp}` })).toBeVisible();
  await expect(page.getByText(`Harika bir hafta ${stamp}`)).toBeVisible();
  await expect(page.getByText("Hedefe", { exact: false }).or(page.getByText("net kaldı", { exact: false })).first()).toBeVisible();
  await page.goto("/rapor/olmayanbaglantiolmayanbaglanti");
  await expect(page.getByText("bulunamadı", { exact: false }).first()).toBeVisible();

  // Hazır program: şablon bu haftaya uygulanır; ikinci kez uygulanınca tekrar eklenmez
  await login(page, username, "KocSifre123");
  await page.goto(`${studentUrl}?sekme=program`);
  await page.locator("select[name=templateId]").selectOption({ label: "TYT · dengeli hafta" });
  await page.getByRole("button", { name: "Bu haftaya uygula" }).click();
  await expect(page.getByText(/görev haftaya eklendi/)).toBeVisible();
  await page.getByRole("button", { name: "Bu haftaya uygula" }).click();
  await expect(page.getByText("Şablondaki görevler bu haftada zaten var.")).toBeVisible();

  // Online görüşme odası: koç girer; başka kurumun personeli giremez
  await page.goto(`/gorusme/${studentId}`);
  await expect(page.getByText("Bu görüşme odasına giremezsiniz")).toHaveCount(0);
  await login(page, "kurum@demo.vipozelders.local", "Kurum12345");
  await page.goto(`/gorusme/${studentId}`);
  await expect(page.getByText("Bu görüşme odasına giremezsiniz")).toBeVisible();
});

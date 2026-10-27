import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Kurum paneli: "Kurumlar için" başvurusu → yönetici kurumu açar → kurum sahibi ilk girişte şifresini belirler →
 * sınıf ve program → öğrenci + veli → yoklama (devamsızlık bildirimi) → deneme sonucu → ödeme planı ve makbuz →
 * veli daveti → veli portalı.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const stamp = Date.now().toString(36);
const centerName = `E2e Etüt ${stamp}`;
const ownerEmail = `e2e-kurum-${stamp}@example.com`;
const parentEmail = `e2e-veli-${stamp}@example.com`;
const groupName = `E2e 8-A ${stamp}`;

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

function istanbulWeekday(): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(new Date());
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name) + 1;
}

test.afterAll(async () => {
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = ANY($1)`, [[ownerEmail, parentEmail]]);
  const ids = users.map((u) => u.id);
  await sql(`DELETE FROM "Center" WHERE name = $1`, [centerName]);
  await sql(`DELETE FROM "Notification" WHERE "userId" = ANY($1) OR (type = 'center.application' AND body LIKE $2)`, [ids, `%${centerName}%`]);
  await sql(`DELETE FROM "AuditLog" WHERE "actorId" = ANY($1) OR "entityId" = ANY($1) OR details::text LIKE $2`, [ids, `%${centerName}%`]);
  await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [ids]);
  await sql(`DELETE FROM "CenterApplication" WHERE email = $1`, [ownerEmail]);
  await sql(`DELETE FROM "EmailMessage" WHERE "to" = ANY($1)`, [[ownerEmail, parentEmail]]);
  await sql(`DELETE FROM "LoginAttempt" WHERE identifier LIKE 'center-apply:%' OR identifier LIKE 'register:%' OR identifier = ANY($1)`, [[ownerEmail, parentEmail]]);
});

test("kurum başvurusu → kurum paneli → yoklama, deneme, makbuz → veli portalı", async ({ page }) => {
  // 1) Ziyaretçi ana sayfadan "Kurumlar için" sayfasına gider ve başvurur
  await page.goto("/");
  await page.getByRole("link", { name: "Kurum panelini inceleyin" }).click();
  await expect(page).toHaveURL(/\/kurumlar-icin$/);
  await page.getByLabel("Kurum adı").fill(centerName);
  await page.getByLabel("Yetkili adı soyadı").fill("Kemal Kurucu");
  await page.getByLabel("Cep telefonu").fill("0532 777 88 99");
  await page.getByLabel("E-posta").fill(ownerEmail);
  await page.getByLabel("Öğrenci sayısı").selectOption("50-100");
  await page.getByLabel(/KVKK Aydınlatma Metni/).check();
  await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
  await expect(page.getByText("Başvurunuz alındı!", { exact: false })).toBeVisible();

  // 2) Yönetici başvurudan kurumu açar; giriş bilgileri ekranda görünür
  await login(page, "admin", "Yonetici123");
  await page.goto("/yonetim/kurum-basvurulari");
  const card = page.locator("div", { hasText: centerName }).filter({ has: page.getByRole("link", { name: "Kurumu aç" }) }).last();
  await card.getByRole("link", { name: "Kurumu aç" }).click();
  await expect(page.getByText("başvurusundan dolduruldu", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Kurum adı")).toHaveValue(centerName);
  await page.getByRole("button", { name: "Kurumu aç" }).click();
  await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
  const username = (await page.getByTestId("new-username").innerText()).trim();
  const password = (await page.getByTestId("new-password").innerText()).trim();
  const [application] = await sql<{ status: string; centerId: string }>(`SELECT status, "centerId" FROM "CenterApplication" WHERE email = $1`, [ownerEmail]);
  expect(application.status).toBe("APPROVED");

  // 3) Kurum sahibi geçici şifreyle girer, kendi şifresini belirler, panele düşer
  await login(page, username, password);
  await expect(page).toHaveURL(/\/sifre-degistir$/);
  await page.getByLabel("Geçici şifre").fill(password);
  await page.getByLabel("Yeni şifre", { exact: true }).fill("KurumSifre123");
  await page.getByLabel("Yeni şifre (tekrar)").fill("KurumSifre123");
  await page.getByRole("button", { name: "Şifremi kaydet" }).click();
  await expect(page).toHaveURL(/\/kurum$/);
  await expect(page.getByRole("heading", { name: "Merhaba Kemal" })).toBeVisible();
  await expect(page.getByText("Ücretsiz deneme sürenizin bitmesine", { exact: false })).toHaveCount(0); // 14 gün > 7 gün

  // 4) Sınıf ve bugünkü ders
  await page.goto("/kurum/siniflar");
  await page.getByLabel("Sınıf / grup adı").fill(groupName);
  await page.getByRole("button", { name: "Sınıf oluştur" }).click();
  await expect(page.getByRole("heading", { name: groupName })).toBeVisible();
  const slotForm = page.locator("form", { has: page.getByRole("button", { name: "Programa ekle" }) });
  await slotForm.getByLabel("Gün").selectOption(String(istanbulWeekday()));
  await slotForm.getByLabel("Başlangıç").fill("09:00");
  await slotForm.getByLabel("Bitiş").fill("09:40");
  await slotForm.getByLabel("Ders", { exact: true }).fill("Matematik");
  await slotForm.getByRole("button", { name: "Programa ekle" }).click();
  await expect(page.getByText("Ders programa eklendi.")).toBeVisible();

  // 5) Öğrenci ve veli kaydı
  await page.goto("/kurum/ogrenciler/yeni");
  await page.getByLabel("Ad", { exact: true }).fill("Ece");
  await page.getByLabel("Soyad", { exact: true }).fill(`Deneme${stamp}`);
  await page.getByLabel("Sınıf", { exact: true }).selectOption("8. Sınıf");
  await page.locator("#guardian1FullName").fill("Nur Deneme");
  await page.locator("#guardian1Phone").fill("0533 222 33 44");
  await page.locator("#guardian1Email").fill(parentEmail);
  await page.getByLabel(groupName).check();
  await page.getByRole("button", { name: "Öğrenciyi kaydet" }).click();
  await expect(page.getByText("Öğrenci kaydedildi.")).toBeVisible();
  const studentUrl = page.url().split("?")[0];
  const [student] = await sql<{ id: string; studentNumber: string }>(`SELECT s.id, s."studentNumber" FROM "CenterStudent" s JOIN "Center" c ON c.id = s."centerId" WHERE c.name = $1`, [centerName]);
  expect(student.studentNumber).toBe("1001");

  // 6) Yoklama: gelmedi → veliye mesaj kuyruğa girer (bildirim kanalı varsayılan olarak e-posta; WhatsApp onay aşamasında)
  await page.goto("/kurum/yoklama");
  await page.getByRole("link", { name: "Yoklama al" }).first().click();
  await expect(page.getByRole("heading", { name: `${groupName} · Matematik` })).toBeVisible();
  await page.getByRole("radio", { name: "Gelmedi" }).click();
  await page.getByRole("button", { name: "Yoklamayı kaydet" }).click();
  await expect(page.getByText("Yoklama kaydedildi: 0 geldi, 1 gelmedi.", { exact: false })).toBeVisible();
  await expect(page.getByText("1 öğrencinin velisine bildirim gönderildi", { exact: false })).toBeVisible();
  const messages = await sql<{ channel: string; to: string }>(`SELECT channel, "to" FROM "CenterMessage" WHERE "studentId" = $1 AND kind = 'absence' ORDER BY channel`, [student.id]);
  expect(messages).toEqual([{ channel: "EMAIL", to: parentEmail }]);
  // Aynı yoklama yeniden kaydedilirse veliye ikinci mesaj gitmez
  await page.reload();
  await page.getByRole("button", { name: "Yoklamayı kaydet" }).click();
  await expect(page.getByText("Yoklama kaydedildi", { exact: false })).toBeVisible();
  expect((await sql(`SELECT 1 FROM "CenterMessage" WHERE "studentId" = $1 AND kind = 'absence'`, [student.id])).length).toBe(1);

  // 7) Deneme: serbest sınav, 4 yanlış 1 doğruyu götürür; 15 D 3 Y → 14,25 net
  await page.goto("/kurum/denemeler");
  await page.getByLabel("Sınav türü").selectOption("CUSTOM");
  await page.getByLabel("Deneme adı").fill("E2e deneme");
  await page.getByLabel("Yanlış götürme").selectOption("4");
  await page.getByRole("button", { name: "Denemeyi oluştur" }).click();
  await expect(page.getByText("Deneme oluşturuldu.", { exact: false })).toBeVisible();
  await page.getByLabel("Doğru", { exact: true }).fill("15");
  await page.getByLabel("Yanlış", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Sonuçları kaydet" }).click();
  await expect(page.getByText("1 öğrencinin sonucu kaydedildi", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Sonuçlar ve analiz" }).click();
  await expect(page.getByRole("cell", { name: "14,25" }).first()).toBeVisible();

  // 8) Ödeme planı (2 taksit) → tahsilat → makbuz yazıyla tutar
  await page.goto(`${studentUrl}?sekme=odemeler`);
  await page.getByLabel("Toplam ücret (TL)").fill("10.000");
  await page.getByLabel("Taksit sayısı").fill("2");
  await page.getByRole("button", { name: "Ödeme planını oluştur" }).click();
  await expect(page.getByText("Ödeme planı oluşturuldu.")).toBeVisible();
  await page.getByRole("link", { name: "Tahsilat ekle" }).click();
  await expect(page.getByLabel("Tutar (TL)")).toHaveValue("5000");
  await page.getByRole("button", { name: "Tahsilatı kaydet ve makbuz oluştur" }).click();
  await expect(page).toHaveURL(/\/kurum\/muhasebe\/makbuz\//);
  await expect(page.getByText("Yalnız beş bin Türk lirası")).toBeVisible();
  await expect(page.getByText("Kalan borç:")).toContainText("₺5.000");

  // 9) Veli daveti: bağlantı oluşturulur
  await page.goto(studentUrl);
  await page.getByRole("button", { name: "Yalnızca bağlantı oluştur" }).click();
  const inviteUrl = (await page.getByTestId("invite-url").innerText()).trim();
  const invitePath = new URL(inviteUrl).pathname;
  expect(invitePath).toMatch(/^\/kurum-davet\//);

  // 10) Veli davet bağlantısını açar, hesap oluşturur ve öğrenciye bağlanır
  await page.context().clearCookies();
  await page.goto(invitePath);
  await expect(page.getByRole("heading", { name: `${centerName} veli portalı` })).toBeVisible();
  await page.getByRole("link", { name: "Ücretsiz hesap aç" }).click();
  await page.getByLabel("Ad", { exact: true }).fill("Nur");
  await page.getByLabel("Soyad", { exact: true }).fill("Deneme");
  await page.getByLabel("E-posta", { exact: true }).fill(parentEmail);
  await page.getByLabel("Şifre", { exact: true }).fill("VeliSifre123");
  await page.getByLabel(/KVKK Aydınlatma Metni/).check();
  await page.getByLabel(/Kullanım Şartları/).check();
  await page.getByRole("button", { name: "Hesabımı oluştur" }).click();
  await expect(page).toHaveURL(new RegExp(`${invitePath}$`));
  await page.getByRole("button", { name: "Hesabıma bağla" }).click();
  await expect(page.getByText("Hesabınız öğrenciye bağlandı", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Ece Deneme${stamp}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kurumum (etüt / dershane)" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Devam ve etüt" }).click();
  await expect(page.getByText("Gelmedi").first()).toBeVisible();
  // Yayınlanmamış deneme veliye görünmez
  await page.getByRole("link", { name: "Denemeler", exact: true }).click();
  await expect(page.getByText("Yayınlanmış deneme sonucu yok")).toBeVisible();
});

test("kurum personeli kendi giriş sayfasından panele girer", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/kurum/ogrenciler");
  await expect(page).toHaveURL(/\/kurum-giris\?next=/);
  await page.goto("/kurum-giris?kurum=basari-etut-merkezi");
  await expect(page.getByRole("heading", { name: "Başarı Etüt Merkezi" })).toBeVisible();
  await page.getByLabel("E-posta veya kullanıcı adı").fill("kurum@demo.vipozelders.local");
  await page.getByLabel("Şifre", { exact: true }).fill("Kurum12345");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/kurum$/);
  // Oturum açıkken giriş sayfası doğrudan panele geçirir
  await page.goto("/kurum-giris");
  await expect(page).toHaveURL(/\/kurum$/);
});

test("ödev verilir, kontrol edilir; veli portalda görür; tüm veriler Excel olarak iner", async ({ page }) => {
  const title = `E2e ödev ${stamp}`;
  try {
    await login(page, "kurum@demo.vipozelders.local", "Kurum12345");
    await page.goto("/kurum/odevler");
    await page.getByLabel("Kime").selectOption({ label: "8-A LGS (tüm sınıf)" });
    await page.getByLabel("Ders", { exact: true }).fill("Matematik");
    await page.getByLabel("Ödev", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Ödevi ver" }).click();
    await expect(page.getByText("Ödev verildi", { exact: false })).toBeVisible();
    // Ali Demirtaş (demo velinin çocuğu) ödevi yapmadı
    const row = page.locator("li", { hasText: "Ali Demirtaş" });
    await row.getByRole("radio", { name: "Yapmadı" }).click();
    await page.getByRole("button", { name: "Kontrolü kaydet" }).click();
    await expect(page.getByText("velisine bildirim gönderildi", { exact: false })).toBeVisible();

    const backup = await page.request.get("/api/kurum/disa-aktar/tum-veriler");
    expect(backup.status()).toBe(200);
    expect(backup.headers()["content-type"]).toContain("spreadsheetml");

    await login(page, "veli@demo.vipozelders.local", "Veli12345");
    await page.goto("/hesabim/kurum");
    await page.getByRole("link", { name: /Ali Demirtaş/ }).click();
    await page.getByRole("link", { name: "Ödevler", exact: true }).click();
    const item = page.locator("li", { hasText: title });
    await expect(item.getByText("Yapmadı")).toBeVisible();
  } finally {
    await sql(`DELETE FROM "Notification" WHERE body LIKE $1 OR title LIKE $2`, [`%${title}%`, "%ödevini yapmadı%"]);
    await sql(`DELETE FROM "CenterMessage" WHERE kind IN ('homework', 'homework_missing') AND (body LIKE $1 OR subject LIKE $2)`, [`%${title}%`, "%Matematik%"]);
    await sql(`DELETE FROM "CenterHomework" WHERE title = $1`, [title]);
  }
});

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("öğrenci hesabı → fotoğrafla soru → öğretmen çözümü; yanlış kapıdan giren kendi paneline gider", async ({ page }) => {
  const [ali] = await sql<{ id: string }>(`SELECT s.id FROM "CenterStudent" s JOIN "Center" c ON c.id = s."centerId" WHERE c.slug = 'basari-etut-merkezi' AND s."firstName" = 'Ali' AND s."lastName" = 'Demirtaş'`);
  const note = `E2e soru ${stamp}`;
  try {
    // Veli kurum girişinden girse de kendi paneline gider
    await page.context().clearCookies();
    await page.goto("/kurum-giris");
    await page.getByLabel("E-posta veya kullanıcı adı").fill("veli@demo.vipozelders.local");
    await page.getByLabel("Şifre", { exact: true }).fill("Veli12345");
    await page.getByRole("button", { name: "Giriş yap" }).click();
    await expect(page).toHaveURL(/\/hesabim$/);

    // Kurum öğrenci giriş hesabı açar
    await login(page, "kurum@demo.vipozelders.local", "Kurum12345");
    await page.goto(`/kurum/ogrenciler/${ali.id}`);
    await page.getByRole("button", { name: "Öğrenci giriş hesabı aç" }).click();
    await expect(page.getByText("Giriş bilgileri hazır")).toBeVisible();
    const username = (await page.getByTestId("new-username").innerText()).trim();
    const password = (await page.getByTestId("new-password").innerText()).trim();

    // Öğrenci kişisel girişten girer, şifresini belirler, soru gönderir
    await login(page, username, password);
    await expect(page).toHaveURL(/\/sifre-degistir$/);
    await page.getByLabel("Geçici şifre").fill(password);
    await page.getByLabel("Yeni şifre", { exact: true }).fill("OgrenciSifre123");
    await page.getByLabel("Yeni şifre (tekrar)").fill("OgrenciSifre123");
    await page.getByRole("button", { name: "Şifremi kaydet" }).click();
    await expect(page).toHaveURL(/\/hesabim$/);
    await page.goto("/hesabim/kurum");
    await page.getByRole("link", { name: /Ali Demirtaş/ }).click();
    await page.getByRole("link", { name: "Soru sor" }).click();
    await page.locator('input[name="image"]').setInputFiles({ name: "soru.png", mimeType: "image/png", buffer: PNG });
    await page.locator('select[name="subject"]').selectOption("Matematik");
    await page.getByLabel("Not (isteğe bağlı)").fill(note);
    await page.getByRole("button", { name: "Soruyu gönder" }).click();
    await expect(page.getByText("Sorun öğretmene iletildi", { exact: false })).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();

    // Öğretmen (Burak, branş Matematik) bildirimi alır ve fotoğraflı çözüm gönderir
    const [question] = await sql<{ id: string }>(`SELECT id FROM "CenterQuestion" WHERE note = $1`, [note]);
    const notified = await sql(`SELECT 1 FROM "Notification" n JOIN "User" u ON u.id = n."userId" WHERE u.email = 'etut.ogretmen@demo.vipozelders.local' AND n.link = $1`, [`/kurum/sorular/${question.id}`]);
    expect(notified.length).toBe(1);
    await login(page, "etut.ogretmen@demo.vipozelders.local", "Ogretmen123");
    await page.goto("/kurum/sorular");
    await page.getByRole("link", { name: new RegExp(note) }).click();
    await page.getByLabel("Açıklama").fill("Üslü sayılarda tabanları eşitle.");
    await page.locator('input[name="image"]').setInputFiles({ name: "cozum.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Çözümü gönder" }).click();
    await expect(page.getByText("Çözüm gönderildi", { exact: false })).toBeVisible();
    const [answered] = await sql<{ status: string; answerImageKey: string }>(`SELECT status, "answerImageKey" FROM "CenterQuestion" WHERE id = $1`, [question.id]);
    expect(answered.status).toBe("ANSWERED");
    // Çözüm dosyası öğretmene açık, giriş yapmamış birine kapalı
    expect((await page.request.get(`/api/dosya/${answered.answerImageKey}`)).status()).toBe(200);
    const anonymous = await page.context().browser()!.newContext();
    expect((await anonymous.request.get(new URL(`/api/dosya/${answered.answerImageKey}`, page.url()).toString())).status()).toBe(403);
    await anonymous.close();

    // Öğrenci çözümü görür
    await login(page, username, "OgrenciSifre123");
    await page.goto("/hesabim/kurum");
    await page.getByRole("link", { name: /Ali Demirtaş/ }).click();
    await page.getByRole("link", { name: "Soru sor" }).click();
    await expect(page.getByText("Üslü sayılarda tabanları eşitle.")).toBeVisible();
    await expect(page.getByText("Çözüldü").first()).toBeVisible();
  } finally {
    const links = await sql<{ userId: string }>(`SELECT "userId" FROM "CenterGuardian" WHERE "studentId" = $1 AND "isStudentAccount" = true`, [ali.id]);
    await sql(`DELETE FROM "Notification" WHERE type = 'center.question' OR (type = 'center.question_answered')`);
    await sql(`DELETE FROM "CenterQuestion" WHERE note = $1`, [note]);
    await sql(`DELETE FROM "CenterGuardian" WHERE "studentId" = $1 AND "isStudentAccount" = true`, [ali.id]);
    for (const { userId } of links) {
      await sql(`DELETE FROM "AuditLog" WHERE "actorId" = $1`, [userId]);
      await sql(`DELETE FROM "User" WHERE id = $1`, [userId]);
    }
  }
});

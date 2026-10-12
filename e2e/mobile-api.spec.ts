import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";

/** Mobil API (Flutter uygulamasının kullanacağı): uygulamanın yaptığı istekler sırayla denenir. */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const API = "/api/mobil/v1";
const startedAt = new Date();
const email = `e2e-mobil-${Date.now().toString(36)}@example.com`;
let bookingId: string | undefined;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

test.afterAll(async () => {
  if (bookingId) {
    await sql(`DELETE FROM "LedgerEntry" WHERE "bookingId" = $1`, [bookingId]);
    await sql(`DELETE FROM "Notification" WHERE link LIKE $1`, [`%/${bookingId}%`]);
    await sql(`DELETE FROM "Booking" WHERE id = $1`, [bookingId]);
  }
  const [teacher] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE username = 'ayse.yilmaz'`);
  await sql(`DELETE FROM "Notification" WHERE "userId" = $1 AND "createdAt" >= $2`, [teacher.id, startedAt]);
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-test'`);
  await sql(`DELETE FROM "User" WHERE email = $1`, [email]);
});

function client(request: APIRequestContext, token?: string) {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return {
    get: (path: string) => request.get(`${API}${path}`, { headers }),
    post: (path: string, data?: unknown) => request.post(`${API}${path}`, { headers, data: data ?? {} }),
    put: (path: string, data: unknown) => request.put(`${API}${path}`, { headers, data }),
    delete: (path: string) => request.delete(`${API}${path}`, { headers }),
  };
}

test("mobil API: kayıt → randevu → ödeme → onay → favori, bildirim, takvim → iptal → çıkış", async ({ request, page }) => {
  const anon = client(request);

  // Açılış verileri ve hata biçimi
  const catalog = await (await anon.get("/katalog")).json();
  expect(catalog.levels.length).toBeGreaterThan(0);
  expect(catalog.paymentReturnPrefix).toMatch(/\/odeme\/sonuc\/$/);
  const unauthorized = await anon.get("/ben");
  expect(unauthorized.status()).toBe(401);
  expect((await unauthorized.json()).error.code).toBe("UNAUTHENTICATED");
  const adminLogin = await anon.post("/oturum", { identifier: "admin", password: "Yonetici123" });
  expect(adminLogin.status()).toBe(403);
  expect((await adminLogin.json()).error.code).toBe("ADMIN_NOT_SUPPORTED");

  // Öğretmen bul, profil ve boş saat
  const search = await (await anon.get("/ogretmenler?q=Ayşe")).json();
  const card = search.items.find((t: { slug: string }) => t.slug === "ayse-yilmaz");
  expect(card).toBeTruthy();
  const profile = await (await anon.get("/ogretmenler/ayse-yilmaz")).json();
  expect(profile).not.toHaveProperty("payoutIban");
  const offering = profile.offerings.find((o: { durations: { minutes: number }[] }) => o.durations.some((d) => d.minutes === 60));
  let slot: { startAt: string } | undefined;
  for (let week = 0; week < 4 && !slot; week++) {
    const start = new Date(Date.now() + week * 7 * 86_400_000).toISOString().slice(0, 10);
    const days = (await (await anon.get(`/ogretmenler/ayse-yilmaz/saatler?duration=60&start=${start}`)).json()).days;
    slot = days.flatMap((d: { slots: { startAt: string; available: boolean }[] }) => d.slots).find((s: { available: boolean }) => s.available);
  }
  expect(slot).toBeTruthy();

  // Kayıt ve oturum
  const registered = await anon.post("/kayit", { firstName: "Mobil", lastName: "Veli", email, password: "MobilVeli2026", accountType: "PARENT", kvkk: true, terms: true, deviceName: "e2e-test" });
  expect(registered.status()).toBe(201);
  const { token, user } = await registered.json();
  expect(user.role).toBe("STUDENT");
  const student = client(request, token);
  const updated = await (await request.patch(`${API}/ben`, { headers: { Authorization: `Bearer ${token}` }, data: { phone: "0532 111 22 33", cityId: 34, accountType: "STUDENT" } })).json();
  expect(updated).toMatchObject({ phone: "05321112233", student: { accountType: "STUDENT", city: { id: 34 } } });
  const badPhone = await request.patch(`${API}/ben`, { headers: { Authorization: `Bearer ${token}` }, data: { phone: "123" } });
  expect((await badPhone.json()).error.fields.phone).toBeTruthy();

  // Doğrulama hatası alan bazında döner
  const invalid = await student.post("/rezervasyonlar", { offeringId: offering.id, startAt: slot!.startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Deniz" });
  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).error.fields.consent).toBeTruthy();

  // Randevu → ödeme adresi WebView'da açılır (burada tarayıcı sayfası) → test ödemesi
  const created = await student.post("/rezervasyonlar", { offeringId: offering.id, startAt: slot!.startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Deniz", learnerGrade: "8. Sınıf", consent: true });
  expect(created.status()).toBe(201);
  const { booking, payment } = await created.json();
  bookingId = booking.id;
  expect(booking.status).toBe("PENDING_PAYMENT");
  expect(booking.actions.canPay).toBe(true);
  expect(payment.url).toContain(`${API}/web-giris?`);
  await page.goto(payment.url);
  await expect(page).toHaveURL(/\/odeme\/test\//);
  await page.getByRole("button", { name: /öde \(başarılı test\)/ }).click();
  await expect(page).toHaveURL(new RegExp(`^${payment.returnUrlPrefix}${booking.id}`));
  // Tek kullanımlık bağlantı ikinci kez oturum açmaz
  await page.context().clearCookies();
  await page.goto(payment.url);
  await expect(page).toHaveURL(/\/giris\?next=/);

  let detail = await (await student.get(`/rezervasyonlar/${booking.id}`)).json();
  expect(detail.status).toBe("PENDING_APPROVAL");
  expect(detail.payments[0].status).toBe("SUCCEEDED");
  expect(detail.actions.cancelPreview.refundPercent).toBe(100);

  // Öğretmen girişi ve onay
  const teacherLogin = await anon.post("/oturum", { identifier: "ayse.yilmaz", password: "Ogretmen123", deviceName: "e2e-test" });
  expect(teacherLogin.status()).toBe(200);
  const teacher = client(request, (await teacherLogin.json()).token);
  const requests = await (await teacher.get("/rezervasyonlar?kapsam=talepler")).json();
  const request_ = requests.items.find((b: { id: string; amount: number }) => b.id === booking.id);
  expect(request_).toBeTruthy();
  // Öğretmen kendi kazancını (komisyon düşülmüş), veli ödediği tutarı görür
  expect(booking.amount).toBe(booking.price);
  expect(request_.amount).toBeLessThan(booking.price);
  expect(request_.amount).toBeGreaterThan(0);
  const forbidden = await student.post(`/rezervasyonlar/${booking.id}/onay`);
  expect(forbidden.status()).toBe(403);
  const approved = await (await teacher.post(`/rezervasyonlar/${booking.id}/onay`)).json();
  expect(approved.status).toBe("CONFIRMED");
  expect(approved.actions.canCancel).toBe(true);

  // Veli tarafı: yaklaşan ders, sınıf henüz kapalı, takvim dosyası
  const upcoming = await (await student.get("/rezervasyonlar?kapsam=yaklasan")).json();
  expect(upcoming.items.find((b: { id: string }) => b.id === booking.id).status).toBe("CONFIRMED");
  const classroom = await student.get(`/rezervasyonlar/${booking.id}/sinif`);
  expect(classroom.status()).toBe(409);
  expect((await classroom.json()).error).toMatchObject({ code: "CLASSROOM_CLOSED" });
  const ics = await student.get(`/rezervasyonlar/${booking.id}/takvim`);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toContain("BEGIN:VEVENT");

  // Favoriler
  expect((await (await student.post(`/favoriler/${card.userId}`)).json()).isFavorite).toBe(true);
  expect((await (await student.get("/favoriler")).json()).items.map((t: { slug: string }) => t.slug)).toContain("ayse-yilmaz");
  expect((await (await student.get("/ogretmenler/ayse-yilmaz")).json()).isFavorite).toBe(true);
  expect((await (await student.delete(`/favoriler/${card.userId}`)).json()).isFavorite).toBe(false);

  // Bildirimler ve push cihazı
  const notifications = await (await student.get("/bildirimler")).json();
  expect(notifications.unread).toBeGreaterThan(0);
  expect(notifications.items.some((n: { target: { screen: string; id?: string } | null }) => n.target?.screen === "booking" && n.target.id === booking.id)).toBe(true);
  expect((await (await student.post("/bildirimler/okundu")).json()).unread).toBe(0);
  expect((await student.post("/cihazlar", { token: `e2e-cihaz-${Date.now()}-anahtar`, platform: "android" })).status()).toBe(201);

  // Öğretmen ekranları: özet, kazanç (IBAN maskeli), takvim ve izin
  const summary = await (await teacher.get("/ogretmen/ozet")).json();
  expect(summary.upcoming.map((b: { id: string }) => b.id)).toContain(booking.id);
  const earnings = await (await teacher.get("/ogretmen/kazanclar")).json();
  expect(JSON.stringify(earnings)).not.toMatch(/TR\d{24}/);
  const calendar = await (await teacher.get("/ogretmen/takvim")).json();
  const saved = await (await teacher.put("/ogretmen/takvim", { rules: calendar.rules, bufferMinutes: calendar.bufferMinutes })).json();
  expect(saved.rules).toEqual(calendar.rules);
  const holiday = new Date(Date.now() + 120 * 86_400_000).toISOString().slice(0, 10);
  expect((await teacher.post("/ogretmen/izinler", { date: holiday, kind: "BLOCKED_DAY", note: "e2e izin" })).status()).toBe(201);
  const exception = (await (await teacher.get("/ogretmen/takvim")).json()).exceptions.find((e: { date: string }) => e.date === holiday);
  expect(exception).toMatchObject({ kind: "BLOCKED_DAY", note: "e2e izin" });
  expect((await teacher.delete(`/ogretmen/izinler/${exception.id}`)).status()).toBe(204);

  // Veli iptal eder (gerekçe zorunlu)
  expect((await student.post(`/rezervasyonlar/${booking.id}/iptal`, { reason: "" })).status()).toBe(422);
  detail = await (await student.post(`/rezervasyonlar/${booking.id}/iptal`, { reason: "Planlarımız değişti" })).json();
  expect(detail.status).toBe("CANCELLED_BY_STUDENT");
  expect((await (await student.get("/rezervasyonlar?kapsam=iptal")).json()).items.map((b: { id: string }) => b.id)).toContain(booking.id);

  // Çıkış: anahtar artık geçersiz
  expect((await student.delete("/oturum")).status()).toBe(204);
  expect((await student.get("/ben")).status()).toBe(401);
});

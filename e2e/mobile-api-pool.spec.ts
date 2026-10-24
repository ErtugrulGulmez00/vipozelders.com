import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";

/**
 * Mobil API: soru kredisi (paket satın alma, WebView ödemesi), soru havuzu (gönder → öğretmen üstlenir, çözer →
 * öğrenci ek soru, puan), mesajlaşma (iletişim bilgisi gizlenir) ve ücretsiz tanışma görüşmesi.
 * Demo öğretmen ayse.yilmaz geçici olarak onaylı, havuza açık ve tanışma sunan yapılır; sonunda geri alınır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const API = "/api/mobil/v1";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);
const email = `e2e-mobil-havuz-${stamp}@example.com`;
const TEACHER = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
let previous: { verificationStatus: string; answersPool: boolean; offersIntro: boolean };

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

function client(request: APIRequestContext, token?: string) {
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  return {
    get: (path: string) => request.get(path.startsWith("http") ? path : `${API}${path}`, { headers }),
    post: (path: string, data?: unknown) => request.post(`${API}${path}`, { headers, data: data ?? {} }),
    put: (path: string, data: unknown) => request.put(`${API}${path}`, { headers, data }),
    multipart: (path: string, form: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>) => request.post(`${API}${path}`, { headers, multipart: form }),
  };
}

test.beforeAll(async () => {
  [previous] = await sql(`SELECT "verificationStatus", "answersPool", "offersIntro" FROM "TeacherProfile" WHERE "userId" = ${TEACHER}`);
  await sql(`UPDATE "TeacherProfile" SET "verificationStatus" = 'VERIFIED', "answersPool" = true, "offersIntro" = true WHERE "userId" = ${TEACHER}`);
});

test.afterAll(async () => {
  const [user] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [email]);
  if (user) {
    const questions = await sql<{ id: string }>(`SELECT id FROM "PoolQuestion" WHERE "studentId" = $1`, [user.id]);
    const ids = questions.map((q) => q.id);
    await sql(`DELETE FROM "LedgerEntry" WHERE "poolQuestionId" = ANY($1)`, [ids]);
    await sql(`DELETE FROM "Notification" WHERE link LIKE ANY($1)`, [ids.map((id) => `%/${id}%`)]);
    const threads = await sql<{ id: string }>(`SELECT id FROM "MessageThread" WHERE "studentId" = $1`, [user.id]);
    await sql(`DELETE FROM "Notification" WHERE link LIKE ANY($1)`, [threads.map((t) => `%/${t.id}%`)]);
    const bookings = await sql<{ id: string }>(`SELECT id FROM "Booking" WHERE "studentId" = $1`, [user.id]);
    await sql(`DELETE FROM "Notification" WHERE link LIKE ANY($1)`, [bookings.map((b) => `%/${b.id}%`)]);
    await sql(`DELETE FROM "Booking" WHERE "studentId" = $1`, [user.id]);
    await sql(`DELETE FROM "Session" WHERE "userId" = $1`, [user.id]);
    await sql(`DELETE FROM "User" WHERE id = $1`, [user.id]);
  }
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-test'`);
  await sql(`UPDATE "TeacherProfile" SET "verificationStatus" = $1, "answersPool" = $2, "offersIntro" = $3 WHERE "userId" = ${TEACHER}`, [
    previous.verificationStatus,
    previous.answersPool,
    previous.offersIntro,
  ]);
});

test("mobil API: kredi al → soru gönder → öğretmen havuzdan çözer; mesajlaşma; ücretsiz tanışma", async ({ request, page }) => {
  const anon = client(request);
  const registered = await anon.post("/kayit", { firstName: "Havuz", lastName: "Veli", email, password: "MobilVeli2026", accountType: "PARENT", kvkk: true, terms: true, deviceName: "e2e-test" });
  expect(registered.status()).toBe(201);
  const student = client(request, (await registered.json()).token);
  const teacherLogin = await anon.post("/oturum", { identifier: "ayse.yilmaz", password: "Ogretmen123", deviceName: "e2e-test" });
  const teacher = client(request, (await teacherLogin.json()).token);

  // Kredi: paketler ve soru gönderilebilecek dersler
  let credits = await (await student.get("/krediler")).json();
  expect(credits.balance).toBe(0);
  expect(credits.packages.length).toBeGreaterThan(0);
  // Demo öğretmenin verdiği bir kademe/ders (havuzda ona düşsün)
  const [pair] = await sql<{ levelId: number; subjectId: number }>(`SELECT "levelId", "subjectId" FROM "TeacherOffering" WHERE "teacherId" = ${TEACHER} AND "isActive" ORDER BY "createdAt" LIMIT 1`);
  const subject = credits.subjects.find((s: { levelId: number; subjectId: number }) => s.levelId === pair.levelId && s.subjectId === pair.subjectId);
  expect(subject).toMatchObject({ levelName: expect.any(String), subjectName: expect.any(String) });
  const noCredit = await student.multipart("/sorular", { levelId: String(subject.levelId), subjectId: String(subject.subjectId), image: { name: "s.png", mimeType: "image/png", buffer: PNG } });
  expect(noCredit.status()).toBe(422);

  // Satın alma: onay zorunlu, ödeme WebView adresinde
  expect((await student.post("/krediler", { credits: credits.packages[0].credits })).status()).toBe(422);
  const pack = credits.packages.find((p: { credits: number }) => p.credits > 1) ?? credits.packages[0];
  const bought = await student.post("/krediler", { credits: pack.credits, consent: true });
  expect(bought.status()).toBe(201);
  const { purchase, payment } = await bought.json();
  expect(purchase).toMatchObject({ credits: pack.credits, status: "PENDING_PAYMENT" });
  await page.goto(payment.url);
  await page.getByRole("button", { name: /öde \(başarılı test\)/ }).click();
  await expect(page).toHaveURL(new RegExp(`^${payment.returnUrlPrefix}${purchase.id}`));
  expect((await (await student.get(`/krediler/${purchase.id}`)).json()).status).toBe("PAID");
  credits = await (await student.get("/krediler")).json();
  expect(credits.balance).toBe(pack.credits);
  expect((await (await student.get("/ben")).json()).questionCredits).toBe(pack.credits);

  // Soru gönder (not içindeki telefon gizlenir)
  const asked = await student.multipart("/sorular", {
    levelId: String(subject.levelId),
    subjectId: String(subject.subjectId),
    note: `Beni 0532 123 45 67 numarasından arayın ${stamp}`,
    image: { name: "soru.png", mimeType: "image/png", buffer: PNG },
  });
  expect(asked.status()).toBe(201);
  const question = await asked.json();
  expect(question).toMatchObject({ status: "OPEN", actions: { canCancel: true, canRate: false } });
  expect(question.note).not.toContain("0532 123 45 67");
  expect((await student.get(question.imageUrl)).status()).toBe(200);
  expect((await (await student.get("/sorular")).json()).items[0].id).toBe(question.id);

  // Öğretmen: havuzda görür, üstlenir, kısa çözüm reddedilir, çözer
  const pool = await (await teacher.get("/ogretmen/soru-havuzu")).json();
  expect(pool.eligible).toBe(true);
  const fromPool = pool.open.find((q: { id: string }) => q.id === question.id);
  expect(fromPool).toBeTruthy();
  expect(JSON.stringify(fromPool)).not.toContain("Havuz Veli");
  expect((await teacher.get(question.imageUrl)).status()).toBe(200);
  const claimed = await (await teacher.post(`/ogretmen/soru-havuzu/${question.id}`, { action: "claim" })).json();
  expect(claimed).toMatchObject({ status: "CLAIMED", mine: true, actions: { canAnswer: true, canClaim: false } });
  expect((await student.post(`/sorular/${question.id}`, { action: "cancel" })).status()).toBe(422);
  const tooShort = await teacher.multipart(`/ogretmen/soru-havuzu/${question.id}`, { body: "x = 4" });
  expect(tooShort.status()).toBe(422);
  const answered = await teacher.multipart(`/ogretmen/soru-havuzu/${question.id}`, {
    body: "Önce iki tarafı 2 ile çarpıyoruz, sonra x'i yalnız bırakıyoruz: x = 4.",
    image: { name: "cozum.png", mimeType: "image/png", buffer: PNG },
  });
  expect(answered.status()).toBe(200);
  expect((await answered.json()).status).toBe("ANSWERED");

  // Öğrenci: çözümü görür, ek soru (bir kez), puan
  let detail = await (await student.get(`/sorular/${question.id}`)).json();
  expect(detail.answer.text).toContain("x = 4");
  expect((await student.get(detail.answer.imageUrl)).status()).toBe(200);
  expect(detail.actions).toMatchObject({ canFollowUp: true, canRate: true, canDispute: true, canCancel: false });
  detail = await (await student.post(`/sorular/${question.id}`, { action: "followUp", body: "Neden 2 ile çarptık?" })).json();
  expect(detail.actions.canFollowUp).toBe(false);
  expect((await student.post(`/sorular/${question.id}`, { action: "followUp", body: "Bir daha" })).status()).toBe(422);
  const followed = await (await teacher.post(`/ogretmen/soru-havuzu/${question.id}`, { action: "followUpAnswer", body: "Kesirden kurtulmak için." })).json();
  expect(followed.answer.followUp.answer).toBe("Kesirden kurtulmak için.");
  detail = await (await student.post(`/sorular/${question.id}`, { action: "rate", rating: 5 })).json();
  expect(detail.rating).toBe(5);
  expect((await (await student.get("/krediler")).json()).balance).toBe(pack.credits - 1);

  // Mesajlaşma: telefon gizlenir, öğretmen soyadın yalnızca baş harfini görür
  const first = await student.post("/ogretmenler/ayse-yilmaz/mesaj", { body: "Merhaba, numaram 0532 111 22 33" });
  expect(first.status()).toBe(201);
  const thread = await first.json();
  expect(thread.messages[0]).toMatchObject({ mine: true, masked: true });
  expect(thread.messages[0].body).not.toContain("0532 111 22 33");
  const inbox = await (await teacher.get("/mesajlar")).json();
  const item = inbox.items.find((t: { id: string }) => t.id === thread.id);
  expect(item).toMatchObject({ unread: true, counterpart: { name: "Havuz V." } });
  const reply = await (await teacher.post(`/mesajlar/${thread.id}`, { body: "Merhaba, profilimden saat seçebilirsiniz." })).json();
  expect(reply.messages).toHaveLength(2);
  expect((await (await student.get("/ben")).json()).unreadMessages).toBe(1);
  const opened = await (await student.get(`/mesajlar/${thread.id}`)).json();
  expect(opened.messages.at(-1)).toMatchObject({ mine: false });
  expect((await (await student.get("/ben")).json()).unreadMessages).toBe(0);

  // Ücretsiz tanışma: 15 dk saatler, ödemesiz doğrudan onaya düşer
  const profile = await (await anon.get("/ogretmenler/ayse-yilmaz")).json();
  expect(profile.offersIntro).toBe(true);
  const slots = await (await anon.get("/ogretmenler/ayse-yilmaz/saatler?duration=15")).json();
  const slot = slots.days.flatMap((d: { slots: { available: boolean; startAt: string }[] }) => d.slots).find((s: { available: boolean }) => s.available);
  expect(slot).toBeTruthy();
  const intro = await student.post("/rezervasyonlar", { offeringId: profile.offerings[0].id, startAt: slot.startAt, durationMinutes: 15, mode: "ONLINE", learnerName: "Ali", intro: true });
  expect(intro.status()).toBe(201);
  const introBody = await intro.json();
  expect(introBody.payment).toBeNull();
  expect(introBody.booking).toMatchObject({ status: "PENDING_APPROVAL", isIntro: true, price: 0 });
});

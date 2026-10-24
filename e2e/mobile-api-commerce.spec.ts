import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Mobil API: indirim kodu ve arkadaşını getir, paket ders (paketten ders, toplu onay, erteleme), aylık soru aboneliği
 * (aboneye soru, öğretmen çözümü), grup dersi kaydı ve öğretmen talep formu. Demo öğretmen ayse.yilmaz'a geçici paket
 * indirimi, abonelik planı ve grup dersi eklenir; sonunda tüm kayıtlar geri alınır.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const API = "/api/mobil/v1";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);
const emails = [`e2e-mobil-ticaret-${stamp}@example.com`, `e2e-mobil-davetli-${stamp}@example.com`];
const coupon = `E2E${stamp.toUpperCase()}`.slice(0, 12);
const TEACHER = `(SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`;
let previousDiscounts: string;
let planId: string;
let previousPlan: { price: number; dailyLimit: number; isActive: boolean } | null = null;
let courseId: string;
const courseCode = `GD-E2E${stamp}`.toUpperCase();

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
    delete: (path: string) => request.delete(`${API}${path}`, { headers }),
    multipart: (path: string, form: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>) => request.post(`${API}${path}`, { headers, multipart: form }),
  };
}

async function pay(page: Page, payment: { url: string; returnUrlPrefix: string }, id: string) {
  await page.goto(payment.url);
  await page.getByRole("button", { name: /öde \(başarılı test\)/ }).click();
  await expect(page).toHaveURL(new RegExp(`^${payment.returnUrlPrefix}${id}`));
}

/** Öğretmenin boş saatlerinden iki tanesi (en az 3 gün sonrası; erteleme dersten 24 saat önce yapılır). */
async function freeSlots(api: ReturnType<typeof client>, duration: number) {
  const start = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  const week = await (await api.get(`/ogretmenler/ayse-yilmaz/saatler?duration=${duration}&start=${start}`)).json();
  return week.days.flatMap((d: { slots: { available: boolean; startAt: string }[] }) => d.slots).filter((s: { available: boolean }) => s.available);
}

test.beforeAll(async () => {
  [{ packageDiscounts: previousDiscounts }] = await sql<{ packageDiscounts: string }>(`SELECT "packageDiscounts" FROM "TeacherProfile" WHERE "userId" = ${TEACHER}`);
  await sql(`UPDATE "TeacherProfile" SET "packageDiscounts" = '3:10' WHERE "userId" = ${TEACHER}`);
  const [offering] = await sql<{ levelId: number; subjectId: number; levelName: string; subjectName: string }>(
    `SELECT o."levelId", o."subjectId", l.name AS "levelName", s.name AS "subjectName" FROM "TeacherOffering" o JOIN "Level" l ON l.id = o."levelId" JOIN "Subject" s ON s.id = o."subjectId"
     WHERE o."teacherId" = ${TEACHER} AND o."isActive" ORDER BY o."createdAt" LIMIT 1`,
  );
  [previousPlan = null] = await sql<{ price: number; dailyLimit: number; isActive: boolean }>(
    `SELECT price, "dailyLimit", "isActive" FROM "QuestionPlan" WHERE "teacherId" = ${TEACHER} AND "levelId" = $1 AND "subjectId" = $2`,
    [offering.levelId, offering.subjectId],
  );
  [{ id: planId }] = await sql<{ id: string }>(
    `INSERT INTO "QuestionPlan" (id, "teacherId", "levelId", "subjectId", price, "dailyLimit", "answerHours", "isActive", "updatedAt")
     VALUES ($1, ${TEACHER}, $2, $3, 25000, 2, 12, true, now())
     ON CONFLICT ("teacherId", "levelId", "subjectId") DO UPDATE SET price = 25000, "dailyLimit" = 2, "isActive" = true RETURNING id`,
    [`e2e-plan-${stamp}`, offering.levelId, offering.subjectId],
  );
  courseId = `e2e-grup-${stamp}`;
  await sql(
    `INSERT INTO "GroupCourse" (id, code, "teacherId", "levelId", "subjectId", "levelName", "subjectName", title, price, "commissionRateBps", capacity, "minParticipants", "enrollDeadline", "updatedAt")
     VALUES ($1, $2, ${TEACHER}, $3, $4, $5, $6, 'E2E grup dersi', 40000, 2000, 6, 2, now() + interval '20 days', now())`,
    [courseId, courseCode, offering.levelId, offering.subjectId, offering.levelName, offering.subjectName],
  );
  await sql(
    `INSERT INTO "GroupSession" (id, "courseId", index, "startAt", "endAt", "videoRoomName") VALUES ($1, $2, 0, now() + interval '25 days', now() + interval '25 days 1 hour', $3)`,
    [`e2e-oturum-${stamp}`, courseId, `e2e-oda-${stamp}`],
  );
  await sql(`INSERT INTO "Coupon" (id, code, kind, value, targets) VALUES ($1, $2, 'PERCENT', 10, ARRAY['credits', 'booking'])`, [`e2e-kupon-${stamp}`, coupon]);
});

test.afterAll(async () => {
  const users = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = ANY($1)`, [emails]);
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await sql(`DELETE FROM "LedgerEntry" WHERE "bookingId" IN (SELECT id FROM "Booking" WHERE "studentId" = ANY($1))`, [ids]);
    await sql(`DELETE FROM "LedgerEntry" WHERE "poolQuestionId" IN (SELECT id FROM "PoolQuestion" WHERE "studentId" = ANY($1))`, [ids]);
    await sql(`DELETE FROM "LedgerEntry" WHERE "subscriptionId" IN (SELECT id FROM "QuestionSubscription" WHERE "studentId" = ANY($1))`, [ids]);
    await sql(`DELETE FROM "LedgerEntry" WHERE "groupEnrollmentId" IN (SELECT id FROM "GroupEnrollment" WHERE "studentId" = ANY($1))`, [ids]);
    await sql(`DELETE FROM "Notification" WHERE "userId" = ${TEACHER} AND "createdAt" > now() - interval '1 hour' AND (type LIKE 'booking.%' OR type LIKE 'package.%' OR type LIKE 'subscription.%' OR type LIKE 'group.%' OR type LIKE 'lesson_request%')`);
    await sql(`DELETE FROM "Booking" WHERE "studentId" = ANY($1)`, [ids]);
    await sql(`DELETE FROM "Session" WHERE "userId" = ANY($1)`, [ids]);
    await sql(`DELETE FROM "User" WHERE id = ANY($1)`, [ids]);
  }
  await sql(`DELETE FROM "LessonRequest" WHERE name = $1`, [`E2E Talep ${stamp}`]);
  await sql(`DELETE FROM "Notification" WHERE type IN ('admin.lesson_request', 'lesson_request') AND "createdAt" > now() - interval '1 hour'`);
  await sql(`DELETE FROM "GroupCourse" WHERE id = $1`, [courseId]);
  if (previousPlan) {
    await sql(`UPDATE "QuestionPlan" SET price = $2, "dailyLimit" = $3, "isActive" = $4 WHERE id = $1`, [planId, previousPlan.price, previousPlan.dailyLimit, previousPlan.isActive]);
  } else {
    await sql(`DELETE FROM "QuestionPlan" WHERE id = $1`, [planId]);
  }
  await sql(`DELETE FROM "Coupon" WHERE code = $1`, [coupon]);
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-test'`);
  await sql(`UPDATE "TeacherProfile" SET "packageDiscounts" = $1 WHERE "userId" = ${TEACHER}`, [previousDiscounts]);
});

test("mobil API: indirim kodu, davet, paket ve erteleme, abonelik, grup dersi, öğretmen talebi", async ({ request, page }) => {
  const anon = client(request);
  const registered = await anon.post("/kayit", { firstName: "Ticaret", lastName: "Veli", email: emails[0], password: "MobilVeli2026", accountType: "PARENT", kvkk: true, terms: true, deviceName: "e2e-test" });
  expect(registered.status()).toBe(201);
  const student = client(request, (await registered.json()).token);
  const teacher = client(request, (await (await anon.post("/oturum", { identifier: "ayse.yilmaz", password: "Ogretmen123", deviceName: "e2e-test" })).json()).token);

  // Arkadaşını getir: davet kodu ve kodla kayıt
  const invite = await (await student.get("/davet")).json();
  expect(invite.code).toMatch(/^[A-Z0-9]{7}$/);
  expect(invite.shareText).toContain(invite.url);
  const invited = await anon.post("/kayit", { firstName: "Davetli", lastName: "Veli", email: emails[1], password: "MobilVeli2026", accountType: "PARENT", kvkk: true, terms: true, deviceName: "e2e-test", referralCode: invite.code });
  expect(invited.status()).toBe(201);
  const [inviter] = await sql<{ referredById: string }>(`SELECT "referredById" FROM "User" WHERE email = $1`, [emails[1]]);
  expect(inviter.referredById).toBe((await (await student.get("/ben")).json()).id);

  // İndirim kodu: kredi paketinde %10
  const credits = await (await student.get("/krediler")).json();
  const pack = credits.packages.find((p: { credits: number }) => p.credits > 1);
  const quote = await (await student.post("/indirim-kodu", { target: "credits", code: coupon.toLowerCase(), credits: pack.credits })).json();
  expect(quote).toMatchObject({ ok: true, discount: Math.floor(pack.price / 10), finalPrice: pack.price - Math.floor(pack.price / 10) });
  expect((await (await student.post("/indirim-kodu", { target: "credits", code: "YOKBOYLEKOD", credits: pack.credits })).json()).ok).toBe(false);
  const bought = await (await student.post("/krediler", { credits: pack.credits, consent: true, couponCode: coupon })).json();
  expect(bought.purchase.price).toBe(pack.price - Math.floor(pack.price / 10));

  // Profilde teklifler: paket indirimi, abonelik planı, grup dersi
  const profile = await (await student.get("/ogretmenler/ayse-yilmaz")).json();
  expect(profile.packageOffers).toEqual([{ lessons: 3, percent: 10 }]);
  expect(profile.questionPlans.find((p: { id: string }) => p.id === planId)).toMatchObject({ price: 25000, dailyLimit: 2 });
  expect(profile.groupCourses.find((c: { code: string }) => c.code === courseCode)).toMatchObject({ price: 40000, sessionCount: 1 });
  const offering = profile.offerings[0];
  const duration = offering.durations.find((d: { minutes: number }) => d.minutes === 60)?.minutes ?? offering.durations[0].minutes;

  // Paket: 3 ders %10 indirimli, ödeme WebView'da
  const created = await student.post("/paketler", { offeringId: offering.id, durationMinutes: duration, lessons: 3, consent: true });
  expect(created.status()).toBe(201);
  const { package: pkg, payment } = await created.json();
  expect(pkg).toMatchObject({ lessonCount: 3, discountPercent: 10, status: "PENDING_PAYMENT" });
  await pay(page, payment, pkg.id);
  expect((await (await student.get(`/paketler/${pkg.id}`)).json()).status).toBe("PAID");
  const withPackage = await (await student.get("/ogretmenler/ayse-yilmaz")).json();
  expect(withPackage.myPackages.find((p: { id: string }) => p.id === pkg.id)).toMatchObject({ left: 3 });

  // Paketten ders: ödeme yok, öğretmen onayına düşer
  const slots = await freeSlots(student, duration);
  expect(slots.length).toBeGreaterThan(2);
  const fromPackage = await student.post("/rezervasyonlar", { offeringId: offering.id, startAt: slots[0].startAt, durationMinutes: duration, mode: "ONLINE", learnerName: "Ali", packageId: pkg.id });
  expect(fromPackage.status()).toBe(201);
  const { booking, payment: noPayment } = await fromPackage.json();
  expect(noPayment).toBeNull();
  expect(booking).toMatchObject({ status: "PENDING_APPROVAL", packageCode: pkg.code, packageId: pkg.id });
  const list = await (await student.get("/paketler")).json();
  expect(list.items.find((p: { id: string }) => p.id === pkg.id)).toMatchObject({ left: 2, active: true, refund: { allowed: false } });

  // Öğretmen paketin taleplerini toplu onaylar
  expect(await (await teacher.post(`/ogretmen/paketler/${pkg.id}`)).json()).toEqual({ approved: 1, failed: 0 });

  // Erteleme: veli yeni saat önerir, öğretmen kabul eder
  let detail = await (await student.get(`/rezervasyonlar/${booking.id}`)).json();
  expect(detail.status).toBe("CONFIRMED");
  expect(detail.reschedule).toMatchObject({ allowed: true, count: 0, pending: null });
  detail = await (await student.post(`/rezervasyonlar/${booking.id}/erteleme`, { action: "request", newStartAt: slots[2].startAt, note: "Okul gezisi var" })).json();
  expect(detail.reschedule.pending).toMatchObject({ mine: true, note: "Okul gezisi var" });
  const asTeacher = await (await teacher.get(`/rezervasyonlar/${booking.id}`)).json();
  expect(asTeacher.reschedule.pending.mine).toBe(false);
  expect((await student.post(`/rezervasyonlar/${booking.id}/erteleme`, { action: "accept", requestId: detail.reschedule.pending.id })).status()).toBe(422);
  const moved = await (await teacher.post(`/rezervasyonlar/${booking.id}/erteleme`, { action: "accept", requestId: asTeacher.reschedule.pending.id })).json();
  expect(new Date(moved.startAt).toISOString()).toBe(new Date(slots[2].startAt).toISOString());
  expect(moved.reschedule).toMatchObject({ count: 1, pending: null });

  // Aylık soru aboneliği: satın al, aboneye soru (kredi harcamaz), öğretmen çözer
  const sub = await student.post("/abonelikler", { planId, consent: true });
  expect(sub.status()).toBe(201);
  const { subscription, payment: subPayment } = await sub.json();
  await pay(page, subPayment, subscription.id);
  const active = await (await student.get(`/abonelikler/${subscription.id}`)).json();
  expect(active).toMatchObject({ status: "ACTIVE", running: true, dailyLimit: 2, usedToday: 0 });
  const asked = await student.multipart(`/abonelikler/${subscription.id}`, { note: `abonelik ${stamp}`, image: { name: "soru.png", mimeType: "image/png", buffer: PNG } });
  expect(asked.status()).toBe(201);
  const question = await asked.json();
  expect(question).toMatchObject({ status: "CLAIMED", subscription: true });
  const pool = await (await teacher.get("/ogretmen/soru-havuzu")).json();
  const mine = pool.mine.find((q: { id: string }) => q.id === question.id);
  expect(mine).toMatchObject({ subscription: true, mine: true });
  const teacherQ = await (await teacher.get(`/ogretmen/soru-havuzu/${question.id}`)).json();
  expect(teacherQ.actions).toMatchObject({ canAnswer: true, canRelease: false, canReject: true });
  const solved = await teacher.multipart(`/ogretmen/soru-havuzu/${question.id}`, { body: "Abonelik sorusunun çözümü: önce sadeleştiririz, sonra x = 3 bulunur." });
  expect((await solved.json()).status).toBe("ANSWERED");
  expect((await (await student.get(`/abonelikler/${subscription.id}`)).json()).usedToday).toBe(1);
  expect((await (await student.get("/abonelikler")).json()).items[0].id).toBe(subscription.id);

  // Grup dersi: liste, ayrıntı, kayıt ve ödeme, iptal (ilk oturumdan önce tam iade)
  const groups = await (await anon.get("/grup-dersleri")).json();
  expect(groups.items.find((c: { code: string }) => c.code === courseCode)).toBeTruthy();
  const course = await (await student.get(`/grup-dersleri/${courseCode}`)).json();
  expect(course).toMatchObject({ title: "E2E grup dersi", actions: { canEnroll: true }, enrollment: null });
  expect(course.sessions[0]).toMatchObject({ canJoin: false });
  const enrolled = await student.post(`/grup-dersleri/${courseCode}`, { learnerName: "Ali", consent: true });
  expect(enrolled.status()).toBe(201);
  const { enrollment, payment: groupPayment } = await enrolled.json();
  await pay(page, groupPayment, enrollment.id);
  expect((await (await student.get(`/grup-kayitlari/${enrollment.id}`)).json()).status).toBe("PAID");
  const myGroups = await (await student.get("/grup-dersleri?kapsam=benim")).json();
  expect(myGroups.items[0]).toMatchObject({ id: enrollment.id, status: "PAID" });
  const teacherGroups = await (await teacher.get("/grup-dersleri?kapsam=benim")).json();
  expect(teacherGroups.items.find((c: { code: string }) => c.code === courseCode)).toMatchObject({ seatsTaken: 1 });
  const closed = await student.get(`/grup-oturumlari/e2e-oturum-${stamp}/sinif`);
  expect(closed.status()).toBe(409);
  const cancelled = await (await student.delete(`/grup-kayitlari/${enrollment.id}`)).json();
  expect(cancelled.status).toBe("CANCELLED");

  // Öğretmen talep formu (misafir de gönderebilir)
  const asked2 = await anon.post("/ogretmen-talebi", { name: `E2E Talep ${stamp}`, phone: "05321234567", mode: "online", preferredTimes: "Hafta içi akşam" });
  expect(asked2.status()).toBe(201);
  expect((await anon.post("/ogretmen-talebi", { name: "A", phone: "1" })).status()).toBe(422);
});

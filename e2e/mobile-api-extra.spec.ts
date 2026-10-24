import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";

/**
 * Mobil API'ye Flutter uygulaması için eklenen uçlar: fotoğrafla soru (multipart), soru yazışması ve çözüm,
 * özel dosyalara Bearer anahtarıyla erişim, kurum (veli portalı) çalışma programı / kaynak ilerlemesi / soru
 * geri çekme / bağlantı kaldırma ve kurum personelinin mobil girişinin engellenmesi.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const API = "/api/mobil/v1";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);
const startedAt = new Date();
const emails: string[] = [];
const bookingIds: string[] = [];
let offeringId: string;

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
    patch: (path: string, data: unknown) => request.patch(`${API}${path}`, { headers, data }),
    delete: (path: string) => request.delete(`${API}${path}`, { headers }),
    multipart: (path: string, form: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>) => request.post(`${API}${path}`, { headers, multipart: form }),
  };
}

async function register(request: APIRequestContext, label: string) {
  const email = `e2e-mobil-${label}-${stamp}@example.com`;
  emails.push(email);
  const response = await request.post(`${API}/kayit`, {
    data: { firstName: "Mobil", lastName: "Veli", email, password: "MobilVeli2026", accountType: "PARENT", kvkk: true, terms: true, deviceName: "e2e-test" },
  });
  expect(response.status()).toBe(201);
  const { token, user } = await response.json();
  return { token: token as string, userId: user.id as string, api: client(request, token) };
}

test.beforeAll(async () => {
  const [row] = await sql<{ id: string }>(
    `SELECT o.id FROM "TeacherOffering" o JOIN "User" u ON u.id = o."teacherId" JOIN "ServiceType" s ON s.id = o."serviceTypeId"
     WHERE u.username = 'ayse.yilmaz' AND s.slug = 'soru-cozum' AND o."isActive" ORDER BY o."createdAt" LIMIT 1`,
  );
  offeringId = row.id;
  await sql(`UPDATE "TeacherOffering" SET "questionPrice" = 15000 WHERE id = $1`, [offeringId]);
});

test.afterAll(async () => {
  await sql(`UPDATE "TeacherOffering" SET "questionPrice" = NULL WHERE id = $1`, [offeringId]);
  for (const id of bookingIds) {
    await sql(`DELETE FROM "LedgerEntry" WHERE "bookingId" = $1`, [id]);
    await sql(`DELETE FROM "Notification" WHERE link LIKE $1`, [`%/${id}%`]);
    await sql(`DELETE FROM "Booking" WHERE id = $1`, [id]);
  }
  await sql(`UPDATE "TeacherProfile" SET "completedLessons" = GREATEST("completedLessons" - $1, 0) WHERE "userId" = (SELECT id FROM "User" WHERE username = 'ayse.yilmaz')`, [bookingIds.length]);
  await sql(`DELETE FROM "Notification" WHERE "createdAt" >= $1 AND (type LIKE 'center.%' OR type LIKE 'question.%' OR type LIKE 'booking.%') AND "userId" IN (SELECT id FROM "User" WHERE username = 'ayse.yilmaz' OR role = 'CENTER' OR email LIKE '%@demo.vipozelders.local')`, [startedAt]);
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-test'`);
  for (const email of emails) await sql(`DELETE FROM "User" WHERE email = $1`, [email]);
});

test("mobil API: fotoğrafla soru → ödeme → öğretmen çözümü → özel dosyaya Bearer ile erişim", async ({ request, page }) => {
  const anon = client(request);

  // Kurum personeli mobil uygulamaya giremez (oturum açılmadan reddedilir)
  const center = await anon.post("/oturum", { identifier: "kurum@demo.vipozelders.local", password: "Kurum12345", deviceName: "e2e-test" });
  expect(center.status()).toBe(403);
  expect((await center.json()).error.code).toBe("CENTER_NOT_SUPPORTED");

  const catalog = await (await anon.get("/katalog")).json();
  expect(typeof catalog.rules.questionAnswerHours).toBe("number");
  const profile = await (await anon.get("/ogretmenler/ayse-yilmaz")).json();
  expect(profile.offerings.find((o: { id: string }) => o.id === offeringId).questionPrice).toBe(15000);

  const { api: student } = await register(request, "soru");

  // WhatsApp bildirim tercihi: varsayılan açık, PATCH /ben ile kapanır
  expect((await (await student.get("/ben")).json()).whatsappNotifications).toBe(true);
  const optOut = await student.patch("/ben", { whatsappNotifications: false });
  expect((await optOut.json()).whatsappNotifications).toBe(false);
  expect("supportWhatsapp" in catalog.site).toBe(true);

  // Alan hataları: fotoğraf ve onay zorunlu
  const noImage = await student.multipart("/rezervasyonlar/soru", { offeringId, learnerName: "Ali", consent: "true" });
  expect(noImage.status()).toBe(422);
  expect((await noImage.json()).error.fields.image).toBeTruthy();
  const noConsent = await student.multipart("/rezervasyonlar/soru", { offeringId, learnerName: "Ali", image: { name: "soru.png", mimeType: "image/png", buffer: PNG } });
  expect(noConsent.status()).toBe(422);
  expect((await noConsent.json()).error.fields.consent).toBeTruthy();

  const created = await student.multipart("/rezervasyonlar/soru", {
    offeringId,
    learnerName: "Ali",
    learnerGrade: "8. Sınıf",
    note: `Türev sorusu ${stamp}`,
    consent: "true",
    image: { name: "soru.png", mimeType: "image/png", buffer: PNG },
  });
  expect(created.status()).toBe(201);
  const { booking, payment } = await created.json();
  bookingIds.push(booking.id);
  expect(booking).toMatchObject({ mode: "QUESTION", status: "PENDING_PAYMENT", price: 15000 });
  expect(booking.question).toMatchObject({ threadOpen: false, messages: [] });

  await page.goto(payment.url);
  await page.getByRole("button", { name: /öde \(başarılı test\)/ }).click();
  await expect(page).toHaveURL(new RegExp(`^${payment.returnUrlPrefix}${booking.id}`));

  let detail = await (await student.get(`/rezervasyonlar/${booking.id}`)).json();
  expect(detail.status).toBe("PENDING_APPROVAL");
  expect(detail.question.answerDeadline).toBeTruthy();
  expect(detail.actions.canMessage).toBe(true);
  const [question] = detail.question.messages;
  expect(question).toMatchObject({ mine: true, fromTeacher: false, body: `Türev sorusu ${stamp}`, isSolution: false });

  // Özel dosya: uygulamanın Bearer anahtarıyla açılır, anahtarsız açılmaz
  const image = await student.get(question.imageUrl);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect((await anon.get(question.imageUrl)).status()).toBe(403);
  const { api: stranger } = await register(request, "yabanci");
  expect((await stranger.get(question.imageUrl)).status()).toBe(403);

  // Öğretmen: onay yerine çözüm gönderir
  const teacherLogin = await anon.post("/oturum", { identifier: "ayse.yilmaz", password: "Ogretmen123", deviceName: "e2e-test" });
  const teacher = client(request, (await teacherLogin.json()).token);
  const asTeacher = await (await teacher.get(`/rezervasyonlar/${booking.id}`)).json();
  expect(asTeacher.actions).toMatchObject({ canApprove: false, canReject: true, canSolve: true, canMessage: true });
  expect(asTeacher.question.messages[0].mine).toBe(false);
  expect((await teacher.get(question.imageUrl)).status()).toBe(200);
  const approve = await teacher.post(`/rezervasyonlar/${booking.id}/onay`);
  expect(approve.status()).toBe(422);
  expect((await approve.json()).error.code).toBe("RULE_VIOLATION");

  const empty = await teacher.multipart(`/rezervasyonlar/${booking.id}/mesajlar`, { body: "" });
  expect(empty.status()).toBe(422);
  const solved = await teacher.multipart(`/rezervasyonlar/${booking.id}/mesajlar`, {
    body: "Önce zincir kuralını uygularız.",
    isSolution: "true",
    image: { name: "cozum.png", mimeType: "image/png", buffer: PNG },
  });
  expect(solved.status()).toBe(200);
  const afterSolve = await solved.json();
  expect(afterSolve.status).toBe("COMPLETED");
  expect(afterSolve.actions.canSolve).toBe(false);
  expect(afterSolve.question.messages.at(-1)).toMatchObject({ mine: true, fromTeacher: true, isSolution: true });

  // Veli çözümü görür ve soru sorar; video yalnızca öğretmen çözümünde
  detail = await (await student.get(`/rezervasyonlar/${booking.id}`)).json();
  const solution = detail.question.messages.at(-1);
  expect(solution).toMatchObject({ fromTeacher: true, isSolution: true, body: "Önce zincir kuralını uygularız." });
  expect((await student.get(solution.imageUrl)).status()).toBe(200);
  const video = await student.multipart(`/rezervasyonlar/${booking.id}/mesajlar`, { body: "video", video: { name: "v.mp4", mimeType: "video/mp4", buffer: PNG } });
  expect(video.status()).toBe(422);
  const followUp = await (await student.multipart(`/rezervasyonlar/${booking.id}/mesajlar`, { body: "3. adımı anlamadım" })).json();
  expect(followUp.question.messages).toHaveLength(3);
  expect(followUp.question.messages.at(-1)).toMatchObject({ mine: true, isSolution: false });

  // Başkasının sorusuna yazılamaz
  expect((await stranger.multipart(`/rezervasyonlar/${booking.id}/mesajlar`, { body: "merhaba" })).status()).toBe(404);
});

test("mobil API: kurum çalışma programı, kaynak ilerlemesi, soru geri çekme ve bağlantı kaldırma", async ({ request }) => {
  const { api: parent, userId } = await register(request, "kurum");
  const [ali] = await sql<{ id: string; centerId: string }>(
    `SELECT s.id, s."centerId" FROM "CenterStudent" s JOIN "CenterGuardian" g ON g."studentId" = s.id JOIN "User" u ON u.id = g."userId" WHERE u.email = 'veli@demo.vipozelders.local' LIMIT 1`,
  );
  const guardianId = `e2e-g-${stamp}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
  await sql(`INSERT INTO "CenterGuardian" (id, "centerId", "studentId", "fullName", relation, "userId", "linkedAt") VALUES ($1, $2, $3, 'E2E Veli', 'Diğer', $4, now())`, [guardianId, ali.centerId, ali.id, userId]);
  await sql(`INSERT INTO "CenterStudyPlanItem" (id, "centerId", "studentId", date, subject, topic, "targetQuestions") VALUES ($1, $2, $3, $4, 'Matematik', 'Üslü ifadeler', 40)`, [`e2e-plan-${stamp}`, ali.centerId, ali.id, today]);
  await sql(`INSERT INTO "CenterResource" (id, "centerId", name, subject, topics) VALUES ($1, $2, 'E2E Soru Bankası', 'Matematik', ARRAY['Üslü ifadeler', 'Olasılık'])`, [`e2e-res-${stamp}`, ali.centerId]);
  await sql(`INSERT INTO "CenterStudentResource" (id, "studentId", "resourceId") VALUES ($1, $2, $3)`, [`e2e-sr-${stamp}`, ali.id, `e2e-res-${stamp}`]);

  try {
    const links = await (await parent.get("/kurum")).json();
    expect(links.items.map((l: { id: string }) => l.id)).toContain(guardianId);
    const child = await (await parent.get(`/kurum/${guardianId}`)).json();
    expect(Array.isArray(child.hallDays)).toBe(true);
    expect(child.questionSubjects).toContain("Matematik");

    // Çalışma programı: madde tamamlandı işaretlenir
    let study = await (await parent.get(`/kurum/${guardianId}/calisma?hafta=${today}`)).json();
    const item = study.items.find((i: { id: string }) => i.id === `e2e-plan-${stamp}`);
    expect(item).toMatchObject({ subject: "Matematik", topic: "Üslü ifadeler", targetQuestions: 40, done: false });
    expect((await parent.post(`/kurum/${guardianId}/calisma/${item.id}`, { done: true })).status()).toBe(200);

    // Kaynak ilerlemesi: yalnızca kaynağın konuları kaydedilir
    const saved = await parent.put(`/kurum/${guardianId}/kaynaklar/e2e-sr-${stamp}`, {
      rows: [
        { topic: "Üslü ifadeler", solved: 10, correct: 8, wrong: 2, done: true },
        { topic: "Uydurma konu", solved: 5, correct: 5, wrong: 0, done: true },
      ],
    });
    expect(saved.status()).toBe(200);
    study = await (await parent.get(`/kurum/${guardianId}/calisma?hafta=${today}`)).json();
    expect(study.items.find((i: { id: string }) => i.id === `e2e-plan-${stamp}`).done).toBe(true);
    const resource = study.resources.find((r: { id: string }) => r.id === `e2e-sr-${stamp}`);
    expect(resource).toMatchObject({ doneCount: 1, topicCount: 2, solved: 10 });
    expect(resource.topics.find((t: { topic: string }) => t.topic === "Üslü ifadeler")).toMatchObject({ done: true, accuracy: 0.8 });
    expect(resource.topics.map((t: { topic: string }) => t.topic)).not.toContain("Uydurma konu");

    // Başkasının kaydına dokunulamaz
    const { api: stranger } = await register(request, "kurum-yabanci");
    expect((await stranger.get(`/kurum/${guardianId}/calisma`)).status()).toBe(404);
    expect((await stranger.post(`/kurum/${guardianId}/calisma/${item.id}`, { done: false })).status()).toBe(404);

    // Kuruma fotoğrafla soru → özel dosya → geri çekme
    const asked = await parent.multipart(`/kurum/${guardianId}/sorular`, { subject: "Matematik", note: `e2e ${stamp}`, image: { name: "soru.png", mimeType: "image/png", buffer: PNG } });
    expect(asked.status()).toBe(201);
    const { id: questionId } = await asked.json();
    const withQuestion = await (await parent.get(`/kurum/${guardianId}`)).json();
    const centerQuestion = withQuestion.questions.find((q: { id: string }) => q.id === questionId);
    expect(centerQuestion).toMatchObject({ mine: true, status: "OPEN" });
    expect((await parent.get(centerQuestion.imageUrl)).status()).toBe(200);
    expect((await stranger.get(centerQuestion.imageUrl)).status()).toBe(403);
    expect((await stranger.delete(`/kurum/${guardianId}/sorular/${questionId}`)).status()).toBe(404);
    expect((await parent.delete(`/kurum/${guardianId}/sorular/${questionId}`)).status()).toBe(204);
    const afterWithdraw = await (await parent.get(`/kurum/${guardianId}`)).json();
    expect(afterWithdraw.questions.map((q: { id: string }) => q.id)).not.toContain(questionId);

    // Bağlantıyı kaldırma
    expect((await parent.delete(`/kurum/${guardianId}`)).status()).toBe(204);
    expect((await (await parent.get("/kurum")).json()).items.map((l: { id: string }) => l.id)).not.toContain(guardianId);
    expect((await parent.get(`/kurum/${guardianId}`)).status()).toBe(404);
  } finally {
    await sql(`DELETE FROM "CenterResourceProgress" WHERE "studentResourceId" = $1`, [`e2e-sr-${stamp}`]);
    await sql(`DELETE FROM "CenterStudentResource" WHERE id = $1`, [`e2e-sr-${stamp}`]);
    await sql(`DELETE FROM "CenterResource" WHERE id = $1`, [`e2e-res-${stamp}`]);
    await sql(`DELETE FROM "CenterStudyPlanItem" WHERE id = $1`, [`e2e-plan-${stamp}`]);
    await sql(`DELETE FROM "CenterQuestion" WHERE note = $1`, [`e2e ${stamp}`]);
    await sql(`DELETE FROM "CenterGuardian" WHERE id = $1`, [guardianId]);
  }
});

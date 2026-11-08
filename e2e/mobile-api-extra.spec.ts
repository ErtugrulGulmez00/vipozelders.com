import { expect, test, type APIRequestContext } from "@playwright/test";
import pg from "pg";

/**
 * Mobil API'ye Flutter uygulaması için eklenen uçlar: özel dosyalara Bearer anahtarıyla erişim, kurum (veli portalı) çalışma programı / kaynak ilerlemesi / soru
 * geri çekme / bağlantı kaldırma ve kurum personelinin mobil girişi.
 */

const DB_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vipozelders";
const API = "/api/mobil/v1";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const stamp = Date.now().toString(36);
const startedAt = new Date();
const emails: string[] = [];

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

test.afterAll(async () => {
  await sql(`DELETE FROM "Notification" WHERE "createdAt" >= $1 AND (type LIKE 'center.%' OR type LIKE 'question.%' OR type LIKE 'booking.%') AND "userId" IN (SELECT id FROM "User" WHERE username = 'ayse.yilmaz' OR role = 'CENTER' OR email LIKE '%@demo.vipozelders.local')`, [startedAt]);
  await sql(`DELETE FROM "Session" WHERE "userAgent" = 'mobil: e2e-test'`);
  for (const email of emails) await sql(`DELETE FROM "User" WHERE email = $1`, [email]);
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
    // Kurum öğretmenine "Yeni soru" bildirimi gitti; geri çekilince kalkmalı
    expect((await sql(`SELECT 1 FROM "Notification" WHERE link = $1`, [`/kurum/sorular/${questionId}`])).length).toBeGreaterThan(0);
    expect((await parent.get(centerQuestion.imageUrl)).status()).toBe(200);
    expect((await stranger.get(centerQuestion.imageUrl)).status()).toBe(403);
    expect((await stranger.delete(`/kurum/${guardianId}/sorular/${questionId}`)).status()).toBe(404);
    expect((await parent.delete(`/kurum/${guardianId}/sorular/${questionId}`)).status()).toBe(204);
    const afterWithdraw = await (await parent.get(`/kurum/${guardianId}`)).json();
    expect(afterWithdraw.questions.map((q: { id: string }) => q.id)).not.toContain(questionId);
    expect(await sql(`SELECT 1 FROM "Notification" WHERE link = $1`, [`/kurum/sorular/${questionId}`])).toHaveLength(0);

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

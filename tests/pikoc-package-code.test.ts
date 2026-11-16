import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { coachPlan, parseCoachTiers } from "@/lib/pi-koc";
import { db } from "@/server/db";
import { generatePackageCodes, generatePromoCodes, redeemPromoCode, sendCoachLimitMails } from "@/server/koc-promo";
import { loadSettings } from "@/server/settings";

afterAll(async () => {
  await db.$disconnect();
});

const DAY = 86_400_000;

async function coachAccount(opts: { paidDays?: number; email?: boolean } = {}) {
  const id = randomUUID().slice(0, 8);
  const user = await db.user.create({
    data: { role: "TEACHER", username: `paket.${id}`, email: opts.email ? `paket.${id}@example.test` : null, firstName: "Paket", lastName: `Kod${id}`, passwordHash: "x" },
  });
  const center = await db.center.create({
    data: {
      name: `Paket ${id} Koçluk`,
      slug: `paket-${id}`,
      kind: "COACH",
      status: "ACTIVE",
      studentLimit: 5,
      paidUntil: opts.paidDays ? new Date(Date.now() + opts.paidDays * DAY) : null,
      members: { create: { userId: user.id, role: "OWNER", title: "Koç" } },
    },
  });
  return { user, center };
}

async function admin() {
  return db.user.create({ data: { role: "ADMIN", username: `admin.pk.${randomUUID().slice(0, 8)}`, firstName: "A", lastName: "B", passwordHash: "x" } });
}

describe("Pi Koç paket kodu", () => {
  it("paket kodu ücretli paketi açar, ödeme kaydı oluşur; deneme kodu kullanmış hesapta da çalışır; tek kullanımlık", async () => {
    const settings = await loadSettings();
    const tier = parseCoachTiers(settings.piKocTiers)[1] ?? parseCoachTiers(settings.piKocTiers)[0];
    const a = await admin();
    const [trial] = await generatePromoCodes(a.id, { count: 1, days: 30, note: null, expiresAt: null });
    const [code] = await generatePackageCodes(a.id, { count: 1, students: tier.students, months: 2, note: "havale", expiresAt: null });

    const { user, center } = await coachAccount();
    await redeemPromoCode(user, center.id, trial);
    const result = await redeemPromoCode(user, center.id, code);
    expect(result).toMatchObject({ kind: "PACKAGE", students: tier.students });

    const after = await db.center.findUniqueOrThrow({ where: { id: center.id } });
    expect(coachPlan(after, settings.piKocFreeStudents)).toMatchObject({ state: "paid", paid: true, paidLimit: tier.students });
    expect(Math.round((after.paidUntil!.getTime() - Date.now()) / DAY)).toBeGreaterThanOrEqual(58);
    const payment = await db.centerSubscriptionPayment.findFirstOrThrow({ where: { centerId: center.id } });
    expect(payment).toMatchObject({ amount: tier.priceTl * 100 * 2, months: 2, method: "Paket kodu", reference: code, createdById: a.id });

    const other = await coachAccount();
    await expect(redeemPromoCode(other.user, other.center.id, code)).rejects.toThrow(/daha önce kullanılmış/);
  });

  it("ücretli paketi olan koç paket koduyla yeniler (süre mevcut bitişten uzar)", async () => {
    const settings = await loadSettings();
    const tier = parseCoachTiers(settings.piKocTiers)[0];
    const a = await admin();
    const [code] = await generatePackageCodes(a.id, { count: 1, students: tier.students, months: 1, note: null, expiresAt: null });
    const { user, center } = await coachAccount({ paidDays: 10 });
    await redeemPromoCode(user, center.id, code);
    const after = await db.center.findUniqueOrThrow({ where: { id: center.id } });
    const days = Math.round((after.paidUntil!.getTime() - Date.now()) / DAY);
    expect(days).toBeGreaterThanOrEqual(38);
    expect(days).toBeLessThanOrEqual(42);
  });

  it("kademe dışı öğrenci sayısı ve geçersiz ay reddedilir", async () => {
    const a = await admin();
    await expect(generatePackageCodes(a.id, { count: 1, students: 7777, months: 1, note: null, expiresAt: null })).rejects.toThrow(/Paket bulunamadı/);
    await expect(generatePackageCodes(a.id, { count: 1, students: 5, months: 13, note: null, expiresAt: null })).rejects.toThrow(/1-12 ay/);
  });
});

describe("Pi Koç sınır e-postası", () => {
  it("sınırı dolan koça yalnızca e-posta gider (uygulama bildirimi yok), 14 gün içinde tekrar gitmez", async () => {
    const settings = await loadSettings();
    const { user, center } = await coachAccount({ email: true });
    for (let i = 0; i < settings.piKocFreeStudents; i++) {
      await db.centerStudent.create({ data: { centerId: center.id, firstName: `Öğrenci${i}`, lastName: "Sınır" } });
    }
    const now = new Date();
    await sendCoachLimitMails(now);
    const mails = await db.emailMessage.findMany({ where: { userId: user.id } });
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toMatch(/Öğrenci sınırınız doldu/);
    expect(mails[0].text).toMatch(/aylık/);
    expect(await db.notification.count({ where: { userId: user.id } })).toBe(0);

    await sendCoachLimitMails(new Date(now.getTime() + 3 * DAY));
    expect(await db.emailMessage.count({ where: { userId: user.id } })).toBe(1);
  });

  it("sınırı dolmayan koça gitmez", async () => {
    const { user } = await coachAccount({ email: true });
    await sendCoachLimitMails(new Date());
    expect(await db.emailMessage.count({ where: { userId: user.id } })).toBe(0);
  });
});

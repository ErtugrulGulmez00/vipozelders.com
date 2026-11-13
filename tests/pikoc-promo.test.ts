import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { coachPlan } from "@/lib/pi-koc";
import { db } from "@/server/db";
import { handleCoachRoomEvent } from "@/server/koc-meeting-usage";
import { generatePromoCodes, normalizePromoCode, processCoachOverLimit, redeemPromoCode, revokePromoCode } from "@/server/koc-promo";

afterAll(async () => {
  await db.$disconnect();
});

const DAY = 86_400_000;

async function coachAccount(opts: { paid?: boolean } = {}) {
  const id = randomUUID().slice(0, 8);
  const user = await db.user.create({ data: { role: "TEACHER", username: `promo.${id}`, firstName: "Kod", lastName: `Deneme${id}`, passwordHash: "x" } });
  const center = await db.center.create({
    data: {
      name: `Kod ${id} Koçluk`,
      slug: `kod-${id}`,
      kind: "COACH",
      status: "ACTIVE",
      studentLimit: 5,
      paidUntil: opts.paid ? new Date(Date.now() + 30 * DAY) : null,
      members: { create: { userId: user.id, role: "OWNER", title: "Koç" } },
    },
  });
  return { user, center };
}

async function admin() {
  return db.user.create({ data: { role: "ADMIN", username: `admin.p.${randomUUID().slice(0, 8)}`, firstName: "A", lastName: "B", passwordHash: "x" } });
}

describe("Pi Koç deneme kodu", () => {
  it("kod 30 gün Rehber (5 öğrenci) açar; tek kullanımlık, hesap başına bir kez", async () => {
    const a = await admin();
    const [code, second] = await generatePromoCodes(a.id, { count: 2, days: 30, note: "test", expiresAt: null });
    expect(code).toMatch(/^PIKOC-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(normalizePromoCode(` ${code.toLowerCase().replace(/-/g, " ")} `)).toBe(code);

    const { user, center } = await coachAccount();
    const result = await redeemPromoCode(user, center.id, code.toLowerCase());
    expect(result.students).toBe(5);
    const after = await db.center.findUniqueOrThrow({ where: { id: center.id } });
    const plan = coachPlan(after, 3);
    expect(plan).toMatchObject({ state: "promo", paid: true, studentLimit: 5 });
    expect(Math.round((after.promoUntil!.getTime() - Date.now()) / DAY)).toBe(30);

    // Aynı kod ikinci kez kullanılamaz
    const other = await coachAccount();
    await expect(redeemPromoCode(other.user, other.center.id, code)).rejects.toThrow(/daha önce kullanılmış/);
    // Aynı hesap ikinci kodu kullanamaz (deneme uzatılamaz)
    await expect(redeemPromoCode(user, center.id, second)).rejects.toThrow(/bir kez/);
  });

  it("ücretli paketi olan kullanamaz; geçersiz kod reddedilir; iptal edilen kodun denemesi hemen biter", async () => {
    const a = await admin();
    const [code] = await generatePromoCodes(a.id, { count: 1, days: 30, note: null, expiresAt: null });
    const paid = await coachAccount({ paid: true });
    await expect(redeemPromoCode(paid.user, paid.center.id, code)).rejects.toThrow(/Ücretli paketiniz/);

    const free = await coachAccount();
    await expect(redeemPromoCode(free.user, free.center.id, "PIKOC-AAAA-BBBB")).rejects.toThrow(/geçersiz/);
    await redeemPromoCode(free.user, free.center.id, code);
    const promo = await db.coachPromoCode.findUniqueOrThrow({ where: { code } });
    await revokePromoCode(a.id, promo.id);
    const after = await db.center.findUniqueOrThrow({ where: { id: free.center.id } });
    expect(coachPlan(after, 3).paid).toBe(false);
  });

  it("deneme bitince sınırın üstündeki öğrenciler 7 gün sonra arşive alınır (en son eklenenler), veri silinmez", async () => {
    const { center } = await coachAccount();
    const now = new Date();
    // Deneme bitmiş: 5 aktif öğrenci, ücretsiz sınır 3
    await db.center.update({ where: { id: center.id }, data: { promoUntil: new Date(now.getTime() - DAY), promoStudents: 5 } });
    for (let i = 0; i < 5; i++) {
      await db.centerStudent.create({ data: { centerId: center.id, firstName: `Öğrenci${i}`, lastName: "Test", createdAt: new Date(now.getTime() - (10 - i) * DAY) } });
    }
    await processCoachOverLimit(now);
    expect((await db.center.findUniqueOrThrow({ where: { id: center.id } })).overLimitSince).not.toBeNull();
    expect(await db.centerStudent.count({ where: { centerId: center.id, status: "ACTIVE" } })).toBe(5);

    // 7 gün dolmadan arşiv yok, dolunca en son eklenen 2 öğrenci arşive
    await processCoachOverLimit(new Date(now.getTime() + 6 * DAY));
    expect(await db.centerStudent.count({ where: { centerId: center.id, status: "ACTIVE" } })).toBe(5);
    await processCoachOverLimit(new Date(now.getTime() + 7 * DAY + 60_000));
    const active = await db.centerStudent.findMany({ where: { centerId: center.id, status: "ACTIVE" }, select: { firstName: true } });
    expect(active.map((s) => s.firstName).sort()).toEqual(["Öğrenci0", "Öğrenci1", "Öğrenci2"]);
    expect(await db.centerStudent.count({ where: { centerId: center.id } })).toBe(5);
    expect((await db.center.findUniqueOrThrow({ where: { id: center.id } })).overLimitSince).toBeNull();
  });
});

describe("teftiş izleme", () => {
  it("yönetimin görünmez katılımı görüşme kaydına, süreye ve kişi sayısına karışmaz", async () => {
    const { center } = await coachAccount();
    const student = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ece", lastName: "Teftiş" } });
    const room = `koc-${student.id}`;
    await handleCoachRoomEvent(room, "yonetici:teftis:ab12cd34", "participant_joined", new Date());
    expect(await db.coachMeeting.count({ where: { roomName: room } })).toBe(0);
    await handleCoachRoomEvent(room, "koc-kullanici", "participant_joined", new Date());
    await handleCoachRoomEvent(room, "yonetici:teftis:ab12cd34", "participant_joined", new Date());
    const m = await db.coachMeeting.findFirstOrThrow({ where: { roomName: room } });
    expect(m).toMatchObject({ activeCount: 1, peakCount: 1 });
  });
});

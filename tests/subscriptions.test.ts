import { afterAll, describe, expect, it } from "vitest";
import { completeCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { answerPoolQuestion, expireUnansweredQuestions, rejectPoolQuestion, releasePoolClaim, PoolError, releaseExpiredClaims } from "@/server/question-pool";
import { loadSettings } from "@/server/settings";
import {
  askSubscriptionQuestion,
  createSubscription,
  endSubscriptionEarly,
  processSubscriptions,
  proRataSplit,
  questionsToday,
  refundSubscription,
  saveQuestionPlan,
  startSubscriptionCheckout,
  SubscriptionError,
} from "@/server/subscriptions";
import { createFixture, hoursAfter, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const photo = () => new File([PNG], "soru.png", { type: "image/png" });
const SOLUTION = "Önce iki tarafı 2 ile çarpıyoruz, sonra x'i yalnız bırakıyoruz: x = 4.";
const DAY = 24;

async function planFixture(input: { priceTl?: number; dailyLimit?: number; answerHours?: number } = {}) {
  const fixture = await createFixture();
  const { levelId, subjectId } = fixture.offering;
  const plan = await saveQuestionPlan(fixture.teacher.id, { levelId, subjectId, priceTl: input.priceTl ?? 1000, dailyLimit: input.dailyLimit ?? 2, answerHours: input.answerHours ?? 12, description: "Beni 0532 123 45 67'den arayın", isActive: true });
  const student = await fixture.createStudent();
  return { ...fixture, plan, student };
}

async function subscribe(studentId: string, planId: string, now = NOW) {
  const sub = await createSubscription(studentId, planId);
  await startSubscriptionCheckout(sub.id, studentId, "127.0.0.1");
  const payment = await db.payment.findFirstOrThrow({ where: { subscriptionId: sub.id } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  const result = await completeCheckout(payment.providerToken!, now);
  return { sub: await db.questionSubscription.findUniqueOrThrow({ where: { id: sub.id } }), result };
}

describe("soru aboneliği planı", () => {
  it("öğretmen yalnızca verdiği ders için, sınırlar içinde plan açar; açıklamadaki iletişim bilgisi gizlenir", async () => {
    const f = await planFixture();
    expect(f.plan.price).toBe(100000);
    expect(f.plan.description).not.toContain("0532");
    await expect(saveQuestionPlan(f.teacher.id, { levelId: f.offering.levelId, subjectId: f.offering.subjectId, priceTl: 5, dailyLimit: 2, answerHours: 12, description: null, isActive: true })).rejects.toThrow(SubscriptionError);
    const other = await createFixture();
    await expect(saveQuestionPlan(f.teacher.id, { levelId: other.offering.levelId, subjectId: other.offering.subjectId, priceTl: 1000, dailyLimit: 2, answerHours: 12, description: null, isActive: true })).rejects.toThrow(/verdiğiniz dersler/);
  });
});

describe("abonelik ödemesi", () => {
  it("ödenince 30 gün başlar, %15 komisyon kesilir, öğretmen payı bekleyen hakedişe yazılır", async () => {
    const f = await planFixture();
    const { sub, result } = await subscribe(f.student.id, f.plan.id);
    expect(result).toEqual({ bookingId: sub.id, outcome: "paid" });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.commissionAmount).toBe(15000);
    expect(sub.teacherAmount).toBe(85000);
    expect(sub.startsAt).toEqual(NOW);
    expect(sub.endsAt!.getTime() - NOW.getTime()).toBe(30 * DAY * 3_600_000);
    expect((await teacherBalances(f.teacher.id)).pending).toBe(85000);
  });

  it("yenileme mevcut dönemin bitişinden başlar", async () => {
    const f = await planFixture();
    const first = await subscribe(f.student.id, f.plan.id);
    const second = await subscribe(f.student.id, f.plan.id, hoursAfter(NOW, 20 * DAY));
    expect(second.sub.startsAt).toEqual(first.sub.endsAt);
    await expect(askSubscriptionQuestion(f.student.id, second.sub.id, { note: null, image: photo() }, hoursAfter(NOW, 21 * DAY))).rejects.toThrow(/başlıyor/);
  });
});

describe("abone sorusu", () => {
  it("soru doğrudan öğretmene düşer, havuza bırakılamaz; günlük sınır uygulanır, geri çevrilen sayılmaz", async () => {
    const f = await planFixture({ dailyLimit: 2 });
    const { sub } = await subscribe(f.student.id, f.plan.id);
    const now = hoursAfter(NOW, 1);
    const q1 = await askSubscriptionQuestion(f.student.id, sub.id, { note: "Mail: a@b.com", image: photo() }, now);
    expect(q1.status).toBe("CLAIMED");
    expect(q1.claimedById).toBe(f.teacher.id);
    expect(q1.teacherFee).toBe(0);
    expect(q1.note).not.toContain("a@b.com");
    await expect(releasePoolClaim(f.teacher.id, q1.id)).rejects.toThrow(PoolError);
    // Kilit süresi dolsa bile havuza dönmez
    await releaseExpiredClaims(hoursAfter(now, 6));
    expect(await db.poolQuestion.findUniqueOrThrow({ where: { id: q1.id } })).toMatchObject({ status: "CLAIMED", claimedById: f.teacher.id });

    const q2 = await askSubscriptionQuestion(f.student.id, sub.id, { note: null, image: photo() }, now);
    await expect(askSubscriptionQuestion(f.student.id, sub.id, { note: null, image: photo() }, now)).rejects.toThrow(/soru hakkınızı/);
    await rejectPoolQuestion(f.teacher.id, q2.id, "Fotoğraf okunmuyor");
    expect(await questionsToday(sub.id, now)).toBe(1);
    await askSubscriptionQuestion(f.student.id, sub.id, { note: null, image: photo() }, now);

    await answerPoolQuestion(f.teacher.id, q1.id, { text: SOLUTION, image: null, video: null }, hoursAfter(now, 2));
    // Soru başına ayrı hakediş yok; yalnızca abonelik payı bekliyor
    expect((await teacherBalances(f.teacher.id)).pending).toBe(85000);
  });

  it("öğretmen sınır kadar soruyu süresinde cevaplamazsa abonelik biter, kalan günler iade edilir", async () => {
    const settings = await loadSettings();
    const f = await planFixture({ dailyLimit: 10, answerHours: 2 });
    const { sub } = await subscribe(f.student.id, f.plan.id);
    const asked = hoursAfter(NOW, 3 * DAY);
    for (let i = 0; i < settings.subscriptionMissLimit; i++) await askSubscriptionQuestion(f.student.id, sub.id, { note: null, image: photo() }, asked);
    const late = hoursAfter(asked, 3);
    await expireUnansweredQuestions(late);
    const ended = await db.questionSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(ended.status).toBe("CANCELLED");
    expect(ended.missedCount).toBe(settings.subscriptionMissLimit);
    const { refund, teacherEarned } = proRataSplit(sub, late);
    expect(ended.refundedAmount).toBe(refund);
    expect(refund).toBeGreaterThan(80000);
    expect((await teacherBalances(f.teacher.id)).pending).toBe(teacherEarned);
    const refunds = await db.refund.findMany({ where: { payment: { subscriptionId: sub.id } } });
    expect(refunds.map((r) => r.amount)).toEqual([refund]);
  });
});

describe("iade ve dönem sonu", () => {
  it("soru sorulmadıysa ilk günlerde tam iade; soru sorulduysa iade yok", async () => {
    const f = await planFixture();
    const { sub } = await subscribe(f.student.id, f.plan.id);
    const amount = await refundSubscription(sub.id, f.student.id, hoursAfter(NOW, DAY));
    expect(amount).toBe(100000);
    expect((await teacherBalances(f.teacher.id)).pending).toBe(0);
    expect((await db.questionSubscription.findUniqueOrThrow({ where: { id: sub.id } })).status).toBe("REFUNDED");

    const g = await planFixture();
    const second = await subscribe(g.student.id, g.plan.id);
    await askSubscriptionQuestion(g.student.id, second.sub.id, { note: null, image: photo() }, hoursAfter(NOW, 1));
    await expect(refundSubscription(second.sub.id, g.student.id, hoursAfter(NOW, 2))).rejects.toThrow(/soru gönderdiğiniz/);
  });

  it("dönem bitince kapanır; itiraz ve aktarım süresi dolunca hakediş ödenebilir bakiyeye geçer", async () => {
    const settings = await loadSettings();
    const f = await planFixture();
    const { sub } = await subscribe(f.student.id, f.plan.id);
    const end = sub.endsAt!;
    await processSubscriptions(hoursAfter(end, 1));
    const ended = await db.questionSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(ended.status).toBe("ENDED");
    expect(ended.earningsReleaseAt!.getTime()).toBe(end.getTime() + settings.disputeWindowHours * 3_600_000);
    await processSubscriptions(hoursAfter(end, settings.disputeWindowHours + 1));
    expect(await teacherBalances(f.teacher.id)).toMatchObject({ pending: 0, available: 85000 });
  });

  it("yönetici erken bitirirse geçen günler öğretmende kalır, henüz başlamamış dönem tamamen iade edilir", async () => {
    const f = await planFixture();
    const first = await subscribe(f.student.id, f.plan.id);
    const queued = await subscribe(f.student.id, f.plan.id, hoursAfter(NOW, DAY));
    const when = hoursAfter(NOW, 15 * DAY);
    await endSubscriptionEarly(first.sub.id, "Öğretmen hesabı kapandı", null, when);
    await endSubscriptionEarly(queued.sub.id, "Öğretmen hesabı kapandı", null, when);
    const a = await db.questionSubscription.findUniqueOrThrow({ where: { id: first.sub.id } });
    const b = await db.questionSubscription.findUniqueOrThrow({ where: { id: queued.sub.id } });
    expect(a.status).toBe("CANCELLED");
    expect(a.refundedAmount).toBe(50000);
    expect(b.status).toBe("REFUNDED");
    expect(b.refundedAmount).toBe(100000);
    expect((await teacherBalances(f.teacher.id)).pending).toBe(42500);
  });
});

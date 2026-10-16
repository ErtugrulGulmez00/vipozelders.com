import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { maskContacts } from "@/lib/text";
import { completeCheckout } from "@/server/bookings";
import { createCreditPurchase, creditBalance, CreditError, expireCredits, parsePackages, refundCreditPurchase, refundPreview, singleQuestionPrice, startCreditCheckout } from "@/server/credits";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { settledReleaseAt } from "@/server/pricing";
import {
  answerPoolQuestion,
  askFollowUp,
  askPoolQuestion,
  cancelPoolQuestion,
  claimPoolQuestion,
  disputePoolAnswer,
  expireUnansweredQuestions,
  PoolError,
  rejectPoolQuestion,
  releaseExpiredClaims,
  releasePoolEarnings,
  resolvePoolDispute,
  teacherQuestion,
} from "@/server/question-pool";
import { loadSettings } from "@/server/settings";
import { createFixture, hoursAfter, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

// 1x1 PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const photo = () => new File([PNG], "soru.png", { type: "image/png" });
const SOLUTION = "Önce iki tarafı 2 ile çarpıyoruz, sonra x'i yalnız bırakıyoruz: x = 4.";
const DAY = 24;

/** Onaylı, yayında bir öğretmen + aynı kademe/derste ikinci onaylı öğretmen + öğrenci. */
async function poolFixture() {
  const fixture = await createFixture();
  await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { verificationStatus: "VERIFIED" } });
  const { levelId, subjectId, serviceTypeId } = fixture.offering;
  await db.levelSubject.create({ data: { levelId, subjectId } });
  const id = randomUUID().slice(0, 8);
  const other = await db.user.create({
    data: {
      role: "TEACHER",
      username: `ikinci.${id}`,
      firstName: "İkinci",
      lastName: "Öğretmen",
      passwordHash: "x",
      teacherProfile: { create: { slug: `ikinci-${id}`, status: "PUBLISHED", verificationStatus: "VERIFIED" } },
    },
  });
  await db.teacherOffering.create({ data: { teacherId: other.id, serviceTypeId, levelId, subjectId, hourlyPrice: 100000, durations: [60] } });
  const student = await fixture.createStudent();
  return { ...fixture, other, student, levelId, subjectId };
}

async function buyCredits(studentId: string, credits = 10, now = NOW) {
  const purchase = await createCreditPurchase(studentId, credits);
  await startCreditCheckout(purchase.id, studentId, "127.0.0.1");
  const payment = await db.payment.findFirstOrThrow({ where: { creditPurchaseId: purchase.id } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  const result = await completeCheckout(payment.providerToken!, now);
  return { purchase, payment, result };
}

type Fixture = Awaited<ReturnType<typeof poolFixture>>;
const ask = (f: Fixture, now = NOW) => askPoolQuestion(f.student.id, { levelId: f.levelId, subjectId: f.subjectId, note: "Beni 0532 123 45 67'den arayın", image: photo() }, now);

describe("soru kredisi", () => {
  it("paket ödenince krediler hesaba geçer; ödeme sonucu paketin kimliğini döndürür", async () => {
    const f = await poolFixture();
    const { purchase, result, payment } = await buyCredits(f.student.id, 10);
    expect(result).toEqual({ bookingId: purchase.id, outcome: "paid" });
    expect(await creditBalance(f.student.id, db, NOW)).toBe(10);
    const fresh = await db.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(fresh.status).toBe("PAID");
    expect(fresh.price).toBe(20000);
    expect(fresh.singlePrice).toBe(2500);
    // Tekrar gelen bildirim krediyi iki kez eklemez
    expect((await completeCheckout(payment.providerToken!, NOW)).outcome).toBe("already");
    expect(await creditBalance(f.student.id, db, NOW)).toBe(10);
  });

  it("bilinmeyen paket satılmaz; paket metni ayrıştırılır", async () => {
    const f = await poolFixture();
    await expect(createCreditPurchase(f.student.id, 7)).rejects.toBeInstanceOf(CreditError);
    const packages = parsePackages("1:25, 10:200,20=360, bozuk, 50:750");
    expect(packages.map((p) => p.credits)).toEqual([1, 10, 20, 50]);
    expect(singleQuestionPrice(packages)).toBe(2500);
  });

  it("krediler 12 ay sonra düşer", async () => {
    const f = await poolFixture();
    await buyCredits(f.student.id, 1);
    expect(await creditBalance(f.student.id, db, hoursAfter(NOW, 360 * DAY))).toBe(1);
    const later = hoursAfter(NOW, 370 * DAY);
    expect(await creditBalance(f.student.id, db, later)).toBe(0);
    await expireCredits(later);
    const entries = await db.creditLedger.findMany({ where: { studentId: f.student.id, kind: "EXPIRE" } });
    expect(entries.map((e) => e.amount)).toEqual([-1]);
  });

  it("iade: kullanılan krediler tek soru fiyatından düşülür; sonucu kesinleşmeyen soru varken iade yok", async () => {
    const f = await poolFixture();
    const { purchase } = await buyCredits(f.student.id, 10);
    const settings = await loadSettings();
    const q = await ask(f);
    let preview = await refundPreview(await db.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } }), settings, NOW);
    expect(preview.allowed).toBe(false);

    await claimPoolQuestion(f.teacher.id, q.id, NOW);
    await answerPoolQuestion(f.teacher.id, q.id, { text: SOLUTION, image: null, video: null }, NOW);
    // İtiraz süresi bitene kadar iade yok, sonra 200 − 25 = 175 TL
    preview = await refundPreview(await db.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } }), settings, hoursAfter(NOW, 49));
    expect(preview).toMatchObject({ allowed: true, amount: 17500, used: 1 });
    expect(await refundCreditPurchase(purchase.id, f.student.id, hoursAfter(NOW, 49))).toBe(17500);
    expect(await creditBalance(f.student.id, db, hoursAfter(NOW, 49))).toBe(0);
    expect((await db.creditPurchase.findUniqueOrThrow({ where: { id: purchase.id } })).status).toBe("PARTIALLY_REFUNDED");
    const refund = await db.refund.findFirstOrThrow({ where: { payment: { creditPurchaseId: purchase.id } } });
    expect(refund).toMatchObject({ amount: 17500, status: "SUCCEEDED" });
  });

  it("iade süresi (14 gün) dolunca iade yapılmaz", async () => {
    const f = await poolFixture();
    const { purchase } = await buyCredits(f.student.id, 10);
    await expect(refundCreditPurchase(purchase.id, f.student.id, hoursAfter(NOW, 15 * DAY))).rejects.toBeInstanceOf(CreditError);
  });
});

describe("soru havuzu", () => {
  it("soru → üstlenme → çözüm → 15 gün sonra hakediş; öğrenci adı ve iletişim bilgisi gizli", async () => {
    const f = await poolFixture();
    await buyCredits(f.student.id, 10);
    const q = await ask(f);
    expect(q.note).not.toContain("0532");
    expect(await creditBalance(f.student.id, db, NOW)).toBe(9);
    expect(q.expiresAt).toEqual(hoursAfter(NOW, 24));
    expect(q.teacherFee).toBe(800);
    // Uygun öğretmenlere bildirim gider
    expect(await db.notification.count({ where: { userId: { in: [f.teacher.id, f.other.id] }, type: "pool.new" } })).toBe(2);

    await claimPoolQuestion(f.teacher.id, q.id, NOW);
    // Üstlenilen soruyu diğer öğretmen göremez ve alamaz
    await expect(teacherQuestion(f.other.id, q.id)).rejects.toBeInstanceOf(PoolError);
    await expect(claimPoolQuestion(f.other.id, q.id, NOW)).rejects.toBeInstanceOf(PoolError);

    // Yalnızca şık yazmak yetmez
    await expect(answerPoolQuestion(f.teacher.id, q.id, { text: "Cevap B", image: null, video: null }, NOW)).rejects.toBeInstanceOf(PoolError);
    const answeredAt = hoursAfter(NOW, 0.2);
    await answerPoolQuestion(f.teacher.id, q.id, { text: `${SOLUTION} Sorusu olursa instagram.com/hoca adresime yaz.`, image: photo(), video: null }, answeredAt);
    let fresh = await db.poolQuestion.findUniqueOrThrow({ where: { id: q.id } });
    expect(fresh.status).toBe("ANSWERED");
    expect(fresh.answerText).not.toContain("instagram.com");
    expect(fresh.disputeUntil).toEqual(hoursAfter(answeredAt, 48));
    // Ödeme NOW anında alındı: hakediş itiraz süresinden değil, 15 günlük aktarım süresinden sonra serbest kalır
    expect(fresh.releaseAt).toEqual(hoursAfter(NOW, 15 * DAY));
    expect(await teacherBalances(f.teacher.id)).toEqual({ pending: 800, available: 0, paid: 0 });

    // Bir kez ek soru
    await askFollowUp(f.student.id, q.id, "2 ile neden çarptık?", hoursAfter(NOW, 1));
    await expect(askFollowUp(f.student.id, q.id, "Bir daha", hoursAfter(NOW, 2))).rejects.toBeInstanceOf(PoolError);

    expect(await releasePoolEarnings(hoursAfter(NOW, 49))).toBe(0);
    expect(await releasePoolEarnings(hoursAfter(NOW, 15 * DAY))).toBeGreaterThanOrEqual(1);
    fresh = await db.poolQuestion.findUniqueOrThrow({ where: { id: q.id } });
    expect(fresh.status).toBe("CLOSED");
    expect(await teacherBalances(f.teacher.id)).toEqual({ pending: 0, available: 800, paid: 0 });
  });

  it("kilit süresi dolan soru havuza döner; süresinde çözülmezse kredi iade edilir", async () => {
    const f = await poolFixture();
    await buyCredits(f.student.id, 1);
    const q = await ask(f);
    await claimPoolQuestion(f.teacher.id, q.id, NOW);
    expect(await releaseExpiredClaims(hoursAfter(NOW, 0.4))).toBe(0);
    await releaseExpiredClaims(hoursAfter(NOW, 0.6));
    expect((await db.poolQuestion.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("OPEN");
    // Süre dolmuş kilitle çözüm gönderilemez
    await expect(answerPoolQuestion(f.teacher.id, q.id, { text: SOLUTION, image: null, video: null }, hoursAfter(NOW, 0.7))).rejects.toBeInstanceOf(PoolError);

    expect(await creditBalance(f.student.id, db, NOW)).toBe(0);
    await expireUnansweredQuestions(hoursAfter(NOW, 25));
    expect((await db.poolQuestion.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("EXPIRED");
    expect(await creditBalance(f.student.id, db, hoursAfter(NOW, 25))).toBe(1);
  });

  it("öğretmen geri çevirirse ya da öğrenci geri çekerse kredi iade edilir", async () => {
    const f = await poolFixture();
    await buyCredits(f.student.id, 10);
    const a = await ask(f);
    await claimPoolQuestion(f.teacher.id, a.id, NOW);
    await rejectPoolQuestion(f.teacher.id, a.id, "Fotoğrafta üç soru var");
    const b = await ask(f);
    await cancelPoolQuestion(f.student.id, b.id);
    expect(await creditBalance(f.student.id, db, NOW)).toBe(10);
    expect(await teacherBalances(f.teacher.id)).toEqual({ pending: 0, available: 0, paid: 0 });
    // Üstlenilmiş soru geri çekilemez
    const c = await ask(f);
    await claimPoolQuestion(f.other.id, c.id, NOW);
    await expect(cancelPoolQuestion(f.student.id, c.id)).rejects.toBeInstanceOf(PoolError);
  });

  it("itiraz haklıysa kredi iade, öğretmen hakedişi geri alınır", async () => {
    const f = await poolFixture();
    await buyCredits(f.student.id, 1);
    const q = await ask(f);
    await claimPoolQuestion(f.teacher.id, q.id, NOW);
    await answerPoolQuestion(f.teacher.id, q.id, { text: SOLUTION, image: null, video: null }, NOW);
    await disputePoolAnswer(f.student.id, q.id, "Çözüm yanlış, sonuç 4 değil 6 olmalı", hoursAfter(NOW, 2));
    // İtirazlı soru serbest bırakılmaz
    expect(await releasePoolEarnings(hoursAfter(NOW, 16 * DAY))).toBe(0);
    const admin = await db.user.create({ data: { role: "ADMIN", username: `admin.${q.id}`, firstName: "A", lastName: "B", passwordHash: "x" } });
    await resolvePoolDispute(admin.id, q.id, true, "Sonuç hatalı", hoursAfter(NOW, 3));
    expect((await db.poolQuestion.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("REFUNDED");
    expect(await creditBalance(f.student.id, db, NOW)).toBe(1);
    expect(await teacherBalances(f.teacher.id)).toEqual({ pending: 0, available: 0, paid: 0 });
  });

  it("onaysız öğretmen havuzu görmez; aynı anda en fazla 3 soru üstlenilir", async () => {
    const f = await poolFixture();
    await buyCredits(f.student.id, 10);
    const questions = [await ask(f), await ask(f), await ask(f), await ask(f)];
    await db.teacherProfile.update({ where: { userId: f.other.id }, data: { verificationStatus: "UNVERIFIED" } });
    await expect(claimPoolQuestion(f.other.id, questions[0].id, NOW)).rejects.toBeInstanceOf(PoolError);
    for (const q of questions.slice(0, 3)) await claimPoolQuestion(f.teacher.id, q.id, NOW);
    await expect(claimPoolQuestion(f.teacher.id, questions[3].id, NOW)).rejects.toThrow(/en fazla 3/);
  });

  it("kredisi olmayan öğrenci soru gönderemez", async () => {
    const f = await poolFixture();
    await expect(ask(f)).rejects.toBeInstanceOf(CreditError);
  });
});

describe("yardımcılar", () => {
  it("iletişim bilgileri gizlenir", () => {
    const masked = maskContacts("Ara: 0532 123 45 67, yaz: ali@ornek.com, site www.ornek.com.tr, @hoca_ali. 2x + 3 = 11 ise x = 4");
    expect(masked).not.toMatch(/0532|ali@|ornek\.com|@hoca_ali/);
    expect(masked).toContain("2x + 3 = 11 ise x = 4");
  });

  it("hakediş, itiraz süresi ile ödeme + aktarım süresinden geç olanında serbest kalır", () => {
    const paid = new Date("2030-01-01T10:00:00Z");
    expect(settledReleaseAt(new Date("2030-01-03T10:00:00Z"), paid, 15)).toEqual(new Date("2030-01-16T10:00:00Z"));
    expect(settledReleaseAt(new Date("2030-01-20T10:00:00Z"), paid, 15)).toEqual(new Date("2030-01-20T10:00:00Z"));
    expect(settledReleaseAt(new Date("2030-01-03T10:00:00Z"), null, 15)).toEqual(new Date("2030-01-03T10:00:00Z"));
  });
});

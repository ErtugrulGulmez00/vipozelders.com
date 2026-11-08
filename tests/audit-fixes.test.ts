import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createBookingHold } from "@/server/bookings";
import { db } from "@/server/db";
import { replyToReview } from "@/server/reviews";
import { recordPageView } from "@/server/stats";
import { at, createFixture, LESSON_DAY, NOW } from "./helpers";

// 2026-11 güvenlik taramasında bulunan açıkların regresyon testleri.

afterAll(async () => {
  await db.$disconnect();
});

const code = (prefix: string) => `${prefix}${randomUUID().slice(0, 6).toUpperCase()}`;

describe("indirim kodu aynı anda birden fazla siparişte kullanılamaz", () => {
  it("ders rezervasyonunda da aynı kural: ikinci saat aynı kodla tutulamaz", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    const student = await f.createStudent();
    const coupon = await db.coupon.create({ data: { code: code("DERS"), kind: "PERCENT", value: 10, targets: ["booking"] } });
    await createBookingHold({ studentId: student.id, offeringId: f.offering.id, startAt: at(LESSON_DAY, "10:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Ali", couponCode: coupon.code }, NOW);
    await expect(
      createBookingHold({ studentId: student.id, offeringId: f.offering.id, startAt: at(LESSON_DAY, "12:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Ali", couponCode: coupon.code }, NOW),
    ).rejects.toThrow(/ödemesi tamamlanmamış/);
  });
});

describe("herkese açık metinlerde iletişim bilgisi", () => {
  it("öğretmenin yoruma cevabındaki telefon gizlenir", async () => {
    const f = await createFixture();
    const student = await f.createStudent();
    const booking = await createBookingHold({ studentId: student.id, offeringId: f.offering.id, startAt: at(LESSON_DAY, "15:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" }, NOW);
    const review = await db.review.create({ data: { bookingId: booking.id, teacherId: f.teacher.id, studentId: student.id, rating: 5, comment: "Harika" } });
    await replyToReview(review.id, f.teacher.id, "Teşekkürler, bana 0532 123 45 67 numarasından ulaşın");
    const saved = await db.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(saved.teacherReply).not.toContain("123 45 67");
  });
});

describe("istatistik ucu", () => {
  it("aynı ziyaretçi günde 300'den fazla görüntüleme yazamaz", async () => {
    const ua = `Mozilla/5.0 test-${randomUUID()}`;
    for (let i = 0; i < 305; i++) await recordPageView({ path: `/x${i}`, referrer: null, userAgent: ua, ip: "203.0.113.9", ownHost: "pikampus.com" });
    const views = await db.pageView.count({ where: { path: { startsWith: "/x" }, device: { not: "" } } });
    expect(views).toBeGreaterThan(0);
    const mine = await db.pageView.groupBy({ by: ["visitor"], where: { path: { startsWith: "/x" } }, _count: true, orderBy: { _count: { visitor: "desc" } }, take: 1 });
    expect(mine[0]._count).toBeLessThanOrEqual(300);
  });
});

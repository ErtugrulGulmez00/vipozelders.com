import { afterAll, describe, expect, it } from "vitest";
import { createBookingHold } from "@/server/bookings";
import { db } from "@/server/db";
import { canOpenMakeup, LessonLinkError, openQuestionSession, questionSessionRightCount, questionSessionSources } from "@/server/lesson-links";
import { at, createFixture, LESSON_DAY, NOW } from "./helpers";

// Dersle birlikte 30 dakikalık ücretsiz soru çözüm dersi: öğretmenin tercihi, ders başına bir hak.

afterAll(async () => {
  await db.$disconnect();
});

const DAY_AFTER = "2030-01-09";

async function setup(offers = true) {
  const f = await createFixture({ hourlyPrice: 100000 });
  await db.teacherProfile.update({ where: { userId: f.teacher.id }, data: { offersQuestionSession: offers } });
  const student = await f.createStudent();
  const booking = await createBookingHold({ studentId: student.id, offeringId: f.offering.id, startAt: at(LESSON_DAY, "10:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" }, NOW);
  return { f, student, booking };
}

const complete = (id: string) => db.booking.update({ where: { id }, data: { status: "COMPLETED", completedAt: NOW, paidAt: NOW } });

describe("soru çözüm dersi", () => {
  it("söz, ders alındığı andaki tercihten kopyalanır", async () => {
    const on = await setup(true);
    const off = await setup(false);
    expect(on.booking.questionSessionPromised).toBe(true);
    expect(off.booking.questionSessionPromised).toBe(false);
  });

  it("hak ders tamamlanınca doğar; açılan ders ücretsiz, 30 dakika ve onaylıdır; aynı derse ikincisi açılamaz", async () => {
    const { f, booking, student } = await setup();
    expect(await questionSessionRightCount(f.teacher.id)).toBe(0);
    await expect(openQuestionSession({ teacherId: f.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "15:00") }, NOW)).rejects.toThrow(LessonLinkError);

    await complete(booking.id);
    expect(await questionSessionRightCount(f.teacher.id)).toBe(1);

    const session = await openQuestionSession({ teacherId: f.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "15:00") }, NOW);
    expect(session).toMatchObject({ studentId: student.id, teacherId: f.teacher.id, price: 0, teacherAmount: 0, commissionAmount: 0, durationMinutes: 30, status: "CONFIRMED", isTest: true, mode: "ONLINE", serviceName: "Soru çözüm dersi", learnerName: "Ali" });
    expect(await questionSessionRightCount(f.teacher.id)).toBe(0);
    await expect(openQuestionSession({ teacherId: f.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "17:00") }, NOW)).rejects.toThrow(/hak/);
    expect(await db.notification.count({ where: { userId: student.id, type: "booking.question_session" } })).toBe(1);
  });

  it("açılan ders iptal edilirse hak geri gelir", async () => {
    const { f, booking } = await setup();
    await complete(booking.id);
    const session = await openQuestionSession({ teacherId: f.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "15:00") }, NOW);
    await db.booking.update({ where: { id: session.id }, data: { status: "CANCELLED_BY_TEACHER", cancelledAt: NOW } });
    expect((await questionSessionSources(f.teacher.id)).map((s) => s.id)).toEqual([booking.id]);
  });

  it("öğretmen sonradan kapatsa da alınmış dersin hakkı durur; söz verilmemiş ders hak doğurmaz", async () => {
    const on = await setup(true);
    await complete(on.booking.id);
    await db.teacherProfile.update({ where: { userId: on.f.teacher.id }, data: { offersQuestionSession: false } });
    expect(await questionSessionRightCount(on.f.teacher.id)).toBe(1);

    const off = await setup(false);
    await complete(off.booking.id);
    expect(await questionSessionRightCount(off.f.teacher.id)).toBe(0);
    await expect(openQuestionSession({ teacherId: off.f.teacher.id, sourceBookingId: off.booking.id, startAt: at(DAY_AFTER, "15:00") }, NOW)).rejects.toThrow(LessonLinkError);
  });

  it("iade edilmiş ders hak doğurmaz; başka öğretmen açamaz; dolu saate açılamaz", async () => {
    const refunded = await setup();
    await db.booking.update({ where: { id: refunded.booking.id }, data: { status: "COMPLETED", completedAt: NOW, refundedAmount: 1000 } });
    expect(await questionSessionRightCount(refunded.f.teacher.id)).toBe(0);

    const { f, booking } = await setup();
    await complete(booking.id);
    const other = await createFixture();
    await expect(openQuestionSession({ teacherId: other.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "15:00") }, NOW)).rejects.toThrow(LessonLinkError);

    const second = await f.createStudent();
    await createBookingHold({ studentId: second.id, offeringId: f.offering.id, startAt: at(DAY_AFTER, "15:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Veli" }, NOW);
    await expect(openQuestionSession({ teacherId: f.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "15:15") }, NOW)).rejects.toThrow(/başka bir dersiniz/);
  });

  it("soru çözüm dersi telafi hakkını kullanmış sayılmaz", async () => {
    const { f, booking } = await setup();
    await complete(booking.id);
    await openQuestionSession({ teacherId: f.teacher.id, sourceBookingId: booking.id, startAt: at(DAY_AFTER, "15:00") }, NOW);
    expect(await canOpenMakeup(f.teacher.id, booking.id, NOW)).toBe(true);
  });
});

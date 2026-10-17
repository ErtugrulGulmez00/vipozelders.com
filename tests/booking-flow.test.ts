import { afterAll, describe, expect, it } from "vitest";
import {
  approveBooking,
  BookingError,
  cancelByStudent,
  cancelByTeacher,
  completeCheckout,
  completeFinishedLessons,
  createBookingHold,
  expireOverdueApprovals,
  expireStaleHolds,
  getTeacherSlots,
  openDispute,
  rejectBooking,
  releaseDueEarnings,
  resolveDispute,
  startCheckout,
} from "@/server/bookings";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { reviewEligibility, upsertReview } from "@/server/reviews";
import { at, createFixture, hoursAfter, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

/** Rezervasyon + sahte ödeme: talep öğretmen onayına düşer. */
async function bookAndPay(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  studentId: string,
  startAt: Date,
  outcome: "success" | "failure" = "success",
) {
  const booking = await createBookingHold(
    { studentId, offeringId: fixture.offering.id, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" },
    NOW,
  );
  const redirectUrl = await startCheckout(booking.id, studentId, "127.0.0.1", NOW);
  const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
  expect(redirectUrl).toBe(`/odeme/test/${payment.id}`);
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: outcome } } });
  const result = await completeCheckout(payment.providerToken!, NOW);
  return { booking, payment, result };
}

// Ödeme kuruluşu aktarım süresi (varsayılan 15 gün); ödemeler testlerde NOW anında alınır
const SETTLEMENT_HOURS = 15 * 24;

describe("rezervasyon akışı", () => {
  it("ödeme → onay → tamamlama → yorum → hakediş", async () => {
    const fixture = await createFixture({ bufferMinutes: 15 });
    const student = await fixture.createStudent();
    const startAt = at(LESSON_DAY, "18:00");

    const { booking, result } = await bookAndPay(fixture, student.id, startAt);
    expect(result.outcome).toBe("paid");
    expect(booking.price).toBe(100000);
    expect(booking.commissionAmount).toBe(15000);
    expect(booking.teacherAmount).toBe(85000);
    // Saat başı düzende tampon süre uygulanmaz; sonraki tam saat boş kalır.
    expect(booking.blockEndAt).toEqual(hoursAfter(startAt, 1));

    let fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("PENDING_APPROVAL");
    expect(fresh.approvalDeadline).toEqual(hoursAfter(NOW, 12));
    const teacherNotes = await db.notification.findMany({ where: { userId: fixture.teacher.id } });
    expect(teacherNotes.map((n) => n.type)).toContain("booking.request");

    // Talep beklerken saat başkasına görünmez (dolu)
    const days = await getTeacherSlots(fixture.teacher.id, { durationMinutes: 60, startDate: LESSON_DAY, days: 1 }, NOW);
    const slot = days[0].slots.find((s) => s.start.getTime() === startAt.getTime());
    expect(slot?.available).toBe(false);

    // Ödeme dönüşü tekrar gelirse hiçbir şey değişmez
    const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect((await completeCheckout(payment.providerToken!, NOW)).outcome).toBe("already");

    await approveBooking(booking.id, fixture.teacher.id, hoursAfter(NOW, 1));
    fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("CONFIRMED");
    expect(fresh.videoRoomName).toBeTruthy();
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 85000, available: 0, paid: 0 });

    // Ders bitmeden yorum yapılamaz
    expect((await reviewEligibility(student.id, fixture.teacher.id, hoursAfter(startAt, 0.5))).eligible).toBe(false);

    const afterLesson = hoursAfter(startAt, 1.1);
    await completeFinishedLessons(afterLesson);
    fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("COMPLETED");
    expect(fresh.earningsReleaseAt).toEqual(hoursAfter(afterLesson, 48));

    await upsertReview(student.id, fixture.teacher.id, 5, "Çok faydalı bir ders oldu.", afterLesson);
    const profile = await db.teacherProfile.findUniqueOrThrow({ where: { userId: fixture.teacher.id } });
    expect(profile.ratingAvg).toBe(5);
    expect(profile.ratingCount).toBe(1);
    expect(profile.completedLessons).toBe(1);

    // İtiraz süresi dolmadan hakediş serbest kalmaz
    const pendingOnly = { pending: 85000, available: 0, paid: 0 };
    await releaseDueEarnings(hoursAfter(afterLesson, 47));
    expect(await teacherBalances(fixture.teacher.id)).toEqual(pendingOnly);
    // İtiraz süresi dolsa da ödeme kuruluşu parayı ödemeden 15 gün sonra aktarır; o gün gelmeden serbest kalmaz
    await releaseDueEarnings(hoursAfter(afterLesson, 49));
    await releaseDueEarnings(hoursAfter(NOW, SETTLEMENT_HOURS - 1));
    expect(await teacherBalances(fixture.teacher.id)).toEqual(pendingOnly);
    await releaseDueEarnings(hoursAfter(NOW, SETTLEMENT_HOURS));
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 0, available: 85000, paid: 0 });
  });

  it("aynı saate eşzamanlı iki talepten yalnızca biri kabul edilir", async () => {
    const fixture = await createFixture();
    const [a, b, c] = await Promise.all([fixture.createStudent(), fixture.createStudent(), fixture.createStudent()]);
    const startAt = at(LESSON_DAY, "10:00");
    const attempt = (studentId: string) =>
      createBookingHold({ studentId, offeringId: fixture.offering.id, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" }, NOW);

    const results = await Promise.allSettled([attempt(a.id), attempt(b.id), attempt(c.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results.filter((r) => r.status === "rejected")) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(BookingError);
    }
  });

  it("veritabanı kısıtı çakışan kaydı servis dışında da engeller", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const startAt = at(LESSON_DAY, "12:00");
    const first = await createBookingHold(
      { studentId: student.id, offeringId: fixture.offering.id, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" },
      NOW,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, code: _code, createdAt: _c, updatedAt: _u, videoRoomName: _v, ...copy } = first;
    await expect(
      db.booking.create({ data: { ...copy, code: "VD-CAKISMA", startAt: hoursAfter(startAt, 0.5), endAt: hoursAfter(startAt, 1.5), blockEndAt: hoursAfter(startAt, 1.5) } }),
    ).rejects.toThrow();
  });

  it("ödeme süresi dolan saat yeniden satışa açılır", async () => {
    const fixture = await createFixture();
    const [a, b] = await Promise.all([fixture.createStudent(), fixture.createStudent()]);
    const startAt = at(LESSON_DAY, "14:00");
    const input = { offeringId: fixture.offering.id, startAt, durationMinutes: 60, mode: "ONLINE" as const, learnerName: "Ali" };
    const hold = await createBookingHold({ ...input, studentId: a.id }, NOW);
    await expect(createBookingHold({ ...input, studentId: b.id }, hoursAfter(NOW, 0.1))).rejects.toBeInstanceOf(BookingError);
    const later = hoursAfter(NOW, 0.5);
    const second = await createBookingHold({ ...input, studentId: b.id }, later);
    expect(second.status).toBe("PENDING_PAYMENT");
    expect((await db.booking.findUniqueOrThrow({ where: { id: hold.id } })).status).toBe("EXPIRED");
    await expireStaleHolds(hoursAfter(later, 1));
    expect((await db.booking.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("EXPIRED");
  });

  it("yüz yüze derste hizmet ilçesi, adres ve ders yeri kontrol edilir", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const city = await db.city.upsert({ where: { id: 34 }, create: { id: 34, name: "İstanbul", slug: "istanbul" }, update: {} });
    const kadikoy = await db.district.upsert({ where: { cityId_slug: { cityId: city.id, slug: "kadikoy" } }, create: { cityId: city.id, name: "Kadıköy", slug: "kadikoy" }, update: {} });
    const besiktas = await db.district.upsert({ where: { cityId_slug: { cityId: city.id, slug: "besiktas" } }, create: { cityId: city.id, name: "Beşiktaş", slug: "besiktas" }, update: {} });
    await db.teacherProfile.update({
      where: { userId: fixture.teacher.id },
      data: { offersInPerson: true, inPersonAtStudentHome: true, inPersonAtTeacherPlace: false, cityId: city.id, serviceDistricts: { create: [{ districtId: kadikoy.id }] } },
    });
    const base = { studentId: student.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, "15:00"), durationMinutes: 60, mode: "IN_PERSON" as const, learnerName: "Ali" };

    await expect(createBookingHold({ ...base, inPersonPlace: "STUDENT_HOME", districtId: besiktas.id, address: "Barbaros Bulvarı 1" }, NOW)).rejects.toThrow("ilçede yüz yüze ders vermiyor");
    await expect(createBookingHold({ ...base, inPersonPlace: "STUDENT_HOME", districtId: kadikoy.id, address: "" }, NOW)).rejects.toThrow("ilçe ve adres gerekli");
    await expect(createBookingHold({ ...base, inPersonPlace: "TEACHER_PLACE" }, NOW)).rejects.toThrow("kendi yerinde ders vermiyor");

    const booking = await createBookingHold({ ...base, inPersonPlace: "STUDENT_HOME", districtId: kadikoy.id, address: "Moda Caddesi 10" }, NOW);
    expect(booking).toMatchObject({ mode: "IN_PERSON", cityId: city.id, districtId: kadikoy.id, address: "Moda Caddesi 10", inPersonPlace: "STUDENT_HOME" });
  });

  it("başarısız ödemede saat korunur ve tekrar denenebilir", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const { booking, result } = await bookAndPay(fixture, student.id, at(LESSON_DAY, "16:00"), "failure");
    expect(result.outcome).toBe("failed");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_PAYMENT");
    await startCheckout(booking.id, student.id, "127.0.0.1", hoursAfter(NOW, 0.05));
    expect(await db.payment.count({ where: { bookingId: booking.id } })).toBe(2);
  });
});

describe("iptal ve iadeler", () => {
  it("öğretmen reddedince tam iade", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const { booking } = await bookAndPay(fixture, student.id, at(LESSON_DAY, "18:00"));
    await rejectBooking(booking.id, fixture.teacher.id, "O saatte başka bir dersim çıktı", hoursAfter(NOW, 1));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, include: { payments: { include: { refunds: true } } } });
    expect(fresh.status).toBe("REJECTED");
    expect(fresh.refundedAmount).toBe(100000);
    expect(fresh.payments[0].status).toBe("REFUNDED");
    expect(fresh.payments[0].refunds[0].status).toBe("SUCCEEDED");
  });

  it("öğretmen süresinde yanıt vermezse talep düşer ve iade edilir", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const { booking } = await bookAndPay(fixture, student.id, at(LESSON_DAY, "19:00"));
    await expect(approveBooking(booking.id, fixture.teacher.id, hoursAfter(NOW, 13))).rejects.toBeInstanceOf(BookingError);
    await expireOverdueApprovals(hoursAfter(NOW, 13));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("EXPIRED");
    expect(fresh.refundedAmount).toBe(100000);
  });

  it("geç iptalde %50 iade, kalan pay komisyon oranında bölünür", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const startAt = at(LESSON_DAY, "20:00");
    const { booking } = await bookAndPay(fixture, student.id, startAt);
    await approveBooking(booking.id, fixture.teacher.id, hoursAfter(NOW, 1));
    await cancelByStudent(booking.id, student.id, "Hastalandık", hoursAfter(startAt, -10));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("CANCELLED_BY_STUDENT");
    expect(fresh.refundedAmount).toBe(50000);
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 42500, available: 0, paid: 0 });
    await releaseDueEarnings(hoursAfter(startAt, 60));
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 42500, available: 0, paid: 0 });
    await releaseDueEarnings(hoursAfter(NOW, SETTLEMENT_HOURS));
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 0, available: 42500, paid: 0 });
  });

  it("öğretmen iptalinde tam iade ve ceza sayacı", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const { booking } = await bookAndPay(fixture, student.id, at(LESSON_DAY, "11:00"));
    await approveBooking(booking.id, fixture.teacher.id, hoursAfter(NOW, 1));
    await cancelByTeacher(booking.id, fixture.teacher.id, "Acil durum", hoursAfter(NOW, 2));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.refundedAmount).toBe(100000);
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 0, available: 0, paid: 0 });
    expect((await db.teacherProfile.findUniqueOrThrow({ where: { userId: fixture.teacher.id } })).cancellationCount).toBe(1);
  });

  it("itiraz hakedişi durdurur, admin kısmi iadeyle çözer", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const startAt = at(LESSON_DAY, "09:00");
    const { booking } = await bookAndPay(fixture, student.id, startAt);
    await approveBooking(booking.id, fixture.teacher.id, hoursAfter(NOW, 0.5));
    const afterLesson = hoursAfter(startAt, 1.1);
    await completeFinishedLessons(afterLesson);
    await openDispute(booking.id, student.id, "Ders 20 dakika geç başladı", hoursAfter(afterLesson, 2));
    await releaseDueEarnings(hoursAfter(afterLesson, 49));
    expect((await teacherBalances(fixture.teacher.id)).available).toBe(0);

    const admin = await db.user.create({ data: { role: "ADMIN", username: `admin.${booking.id}`, firstName: "A", lastName: "B", passwordHash: "x" } });
    await resolveDispute(booking.id, admin.id, 30000, "Geç başlama nedeniyle kısmi iade", hoursAfter(afterLesson, 50));
    await releaseDueEarnings(hoursAfter(NOW, SETTLEMENT_HOURS));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("COMPLETED");
    expect(fresh.refundedAmount).toBe(30000);
    // Kalan 70.000 kuruşun %85'i öğretmene: 59.500
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 0, available: 59500, paid: 0 });
  });
});

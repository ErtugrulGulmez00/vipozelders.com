import { afterAll, describe, expect, it } from "vitest";
import { approveBooking, BookingError, cancelByStudent, completeCheckout, createBookingHold, packageLessonsLeft, rejectBooking } from "@/server/bookings";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { createLessonPackage, discountFor, packageRefundPreview, parsePackageDiscounts, refundPackage, saveTeacherPackageDiscounts, startPackageCheckout } from "@/server/packages";
import { requestReschedule, respondReschedule } from "@/server/reschedule";
import { at, createFixture, hoursAfter, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

async function buyPackage(studentId: string, offeringId: string, lessons: number, recurring?: Parameters<typeof createLessonPackage>[1]["recurring"]) {
  const pkg = await createLessonPackage(studentId, { offeringId, durationMinutes: 60, lessons, recurring }, NOW);
  await startPackageCheckout(pkg.id, studentId, "127.0.0.1");
  const payment = await db.payment.findFirstOrThrow({ where: { packageId: pkg.id } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  await completeCheckout(payment.providerToken!, NOW);
  return db.lessonPackage.findUniqueOrThrow({ where: { id: pkg.id } });
}

const book = (studentId: string, offeringId: string, packageId: string, startAt: Date) =>
  createBookingHold({ studentId, offeringId, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali", packageId }, NOW);

describe("paket indirimleri", () => {
  it("öğretmenin paket indirimleri okunur; ders sayısını aşmayan en büyük paket uygulanır", () => {
    const offers = parsePackageDiscounts("10:10, 5:5, 1:50, 3:80");
    expect(offers).toEqual([{ lessons: 5, percent: 5 }, { lessons: 10, percent: 10 }]);
    expect(discountFor(offers, 4)).toBe(0);
    expect(discountFor(offers, 7)).toBe(5);
    expect(discountFor(offers, 12)).toBe(10);
  });
});

describe("paket ders", () => {
  it("5 derslik paket %5 indirimli; dersler ödemesiz öğretmen onayına düşer, öğretmen reddederse ders pakete döner", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 5, percent: 5 }]);
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 5);
    expect(pkg).toMatchObject({ status: "PAID", unitPrice: 95000, price: 475000, discountPercent: 5 });

    const first = await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "10:00"));
    expect(first).toMatchObject({ status: "PENDING_APPROVAL", price: 95000, teacherAmount: 80750, packageId: pkg.id });
    expect(first.paidAt).not.toBeNull();
    expect(await packageLessonsLeft(db, pkg)).toBe(4);

    await rejectBooking(first.id, f.teacher.id, "O saatte başka işim var", NOW);
    expect(await packageLessonsLeft(db, pkg)).toBe(5);
    expect(await db.refund.count({ where: { payment: { packageId: pkg.id } } })).toBe(0);

    const second = await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "12:00"));
    await approveBooking(second.id, f.teacher.id, NOW);
    expect((await teacherBalances(f.teacher.id)).pending).toBe(80750);
  });

  it("paket dersi yalnızca aynı ders ve sürede, ders kaldıkça alınır", async () => {
    const f = await createFixture();
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 2, percent: 0 }]);
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 2);
    await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "10:00"));
    await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "12:00"));
    await expect(book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "14:00"))).rejects.toThrow(/ders kalmadı/);
    await expect(createBookingHold({ studentId: student.id, offeringId: f.offering.id, startAt: at(LESSON_DAY, "16:00"), durationMinutes: 45, mode: "ONLINE", learnerName: "Ali", packageId: pkg.id }, NOW)).rejects.toThrow(BookingError);
  });

  it("geç iptalde kısmi iade paketin ödemesinden yapılır ve ders kullanılmış sayılır", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 3, percent: 0 }]);
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 3);
    const lesson = await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "10:00"));
    await approveBooking(lesson.id, f.teacher.id, NOW);
    // Dersten 10 saat önce: %50 iade
    await cancelByStudent(lesson.id, student.id, "Hastalandık", hoursAfter(at(LESSON_DAY, "10:00"), -10));
    const refunds = await db.refund.findMany({ where: { payment: { packageId: pkg.id } } });
    expect(refunds.map((r) => r.amount)).toEqual([50000]);
    expect(await packageLessonsLeft(db, pkg)).toBe(2);
  });

  it("erken iadede kullanılan dersler indirimsiz ücretten düşülür", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 4, percent: 10 }]);
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 4);
    const lesson = await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "10:00"));
    await approveBooking(lesson.id, f.teacher.id, NOW);
    expect((await packageRefundPreview(pkg)).allowed).toBe(false);
    await db.booking.update({ where: { id: lesson.id }, data: { status: "COMPLETED" } });
    const amount = await refundPackage(pkg.id, student.id, NOW);
    // 360.000 ödendi, 1 ders 100.000 (indirimsiz) düşülür
    expect(amount).toBe(260000);
  });
});

describe("tekrarlayan ders", () => {
  it("ödeme sonrası her hafta aynı saatte randevu talebi oluşur", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 0, { startAt: at(LESSON_DAY, "18:00"), weeks: 4, learnerName: "Ali" });
    expect(pkg).toMatchObject({ lessonCount: 4, price: 400000 });
    const bookings = await db.booking.findMany({ where: { packageId: pkg.id }, orderBy: { startAt: "asc" } });
    expect(bookings).toHaveLength(4);
    expect(bookings.map((b) => b.status)).toEqual(["PENDING_APPROVAL", "PENDING_APPROVAL", "PENDING_APPROVAL", "PENDING_APPROVAL"]);
    expect(bookings[3].startAt.getTime() - bookings[0].startAt.getTime()).toBe(21 * 24 * 3_600_000);
  });
});

describe("erteleme", () => {
  it("öğretmen yeni saat önerir, veli kabul edince ders taşınır; aynı anda ikinci öneri olmaz", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 2, percent: 0 }]);
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 2);
    const lessonAt = at("2030-01-10", "10:00");
    const lesson = await book(student.id, f.offering.id, pkg.id, lessonAt);
    await approveBooking(lesson.id, f.teacher.id, NOW);

    const newAt = at("2030-01-10", "15:00");
    const request = await requestReschedule(lesson.id, f.teacher.id, newAt, "Toplantım çıktı", NOW);
    await expect(requestReschedule(lesson.id, student.id, at("2030-01-10", "16:00"), null, NOW)).rejects.toThrow(/zaten var/);
    await expect(respondReschedule(request.id, f.teacher.id, true, NOW)).rejects.toThrow(/karşı taraf/);
    await respondReschedule(request.id, student.id, true, NOW);
    const moved = await db.booking.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(moved.startAt).toEqual(newAt);
    expect(moved.rescheduleCount).toBe(1);
  });

  it("dersten 24 saatten az kala erteleme önerilemez", async () => {
    const f = await createFixture();
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 2, percent: 0 }]);
    const student = await f.createStudent();
    const pkg = await buyPackage(student.id, f.offering.id, 2);
    const lesson = await book(student.id, f.offering.id, pkg.id, at(LESSON_DAY, "10:00"));
    await approveBooking(lesson.id, f.teacher.id, NOW);
    await expect(requestReschedule(lesson.id, student.id, at(LESSON_DAY, "15:00"), null, hoursAfter(at(LESSON_DAY, "10:00"), -5))).rejects.toThrow(/en az 24 saat/);
  });
});

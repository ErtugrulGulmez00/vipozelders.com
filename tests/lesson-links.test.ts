import { afterAll, describe, expect, it } from "vitest";
import { approveBooking, BookingError, completeCheckout, completeFinishedLessons, createBookingHold, startCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { claimLessonLink, createLessonLink, cancelLessonLink, LessonLinkError, makeupSources } from "@/server/lesson-links";
import { at, createFixture, hoursAfter, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

const NOTE = "Hastalandım, dersi o saatte yapamadık; telafi ediyoruz.";

/** Ödenmiş ve onaylanmış ders (telafi kaynağı) */
async function paidLesson(fixture: Awaited<ReturnType<typeof createFixture>>, studentId: string, startAt: Date) {
  const booking = await createBookingHold({ studentId, offeringId: fixture.offering.id, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" }, NOW);
  await startCheckout(booking.id, studentId, "127.0.0.1", NOW);
  const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  await completeCheckout(payment.providerToken!, NOW);
  await approveBooking(booking.id, fixture.teacher.id, NOW);
  return booking;
}

describe("ders bağlantısı", () => {
  it("serbest yetkisi olmayan öğretmen ücretli ders ve gerekçe olmadan bağlantı açamaz", async () => {
    const fixture = await createFixture();
    const startAt = at(LESSON_DAY, "15:00");
    await expect(createLessonLink({ teacherId: fixture.teacher.id, startAt, durationMinutes: 60 }, NOW)).rejects.toThrow("ücretli dersi seçin");

    const student = await fixture.createStudent();
    const paid = await paidLesson(fixture, student.id, at(LESSON_DAY, "18:00"));
    await expect(createLessonLink({ teacherId: fixture.teacher.id, startAt, durationMinutes: 60, sourceBookingId: paid.id, note: "kısa" }, NOW)).rejects.toThrow("Gerekçeyi yazın");

    // Başka öğretmenin ya da ödenmemiş ders kaynak olamaz
    const other = await createFixture();
    await expect(createLessonLink({ teacherId: other.teacher.id, startAt, durationMinutes: 60, sourceBookingId: paid.id, note: NOTE }, NOW)).rejects.toThrow(LessonLinkError);
  });

  it("telafi: yalnızca dersin öğrencisi kullanır, her derse tek telafi, ders ücretsiz ve onaylı oluşur", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const stranger = await fixture.createStudent();
    const paid = await paidLesson(fixture, student.id, at(LESSON_DAY, "18:00"));
    expect((await makeupSources(fixture.teacher.id, NOW)).map((b) => b.id)).toContain(paid.id);

    const link = await createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "15:00"), durationMinutes: 60, sourceBookingId: paid.id, note: NOTE }, NOW);
    expect(link.serviceName).toBe("Telafi dersi");
    // Öğrenciye bildirim gider, kaynak ders artık listede yok, ikinci telafi açılamaz
    expect(await db.notification.count({ where: { userId: student.id, type: "booking.makeup_link" } })).toBe(1);
    expect((await makeupSources(fixture.teacher.id, NOW)).map((b) => b.id)).not.toContain(paid.id);
    await expect(createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "20:00"), durationMinutes: 60, sourceBookingId: paid.id, note: NOTE }, NOW)).rejects.toThrow("telafiye uygun değil");

    // Bağlantının saati takvimde dolu: aynı saate randevu alınamaz
    await expect(createBookingHold({ studentId: stranger.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, "15:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Veli" }, NOW)).rejects.toThrow(BookingError);

    await expect(claimLessonLink(link.token, stranger.id, NOW)).rejects.toThrow("yalnızca dersin öğrencisi");
    const booking = await claimLessonLink(link.token, student.id, NOW);
    expect(booking).toMatchObject({ status: "CONFIRMED", price: 0, teacherAmount: 0, isTest: true, mode: "ONLINE", learnerName: "Ali" });
    expect(booking.videoRoomName).toBeTruthy();
    // Aynı hesap tekrar açarsa aynı ders döner
    expect((await claimLessonLink(link.token, student.id, NOW)).id).toBe(booking.id);
    await expect(cancelLessonLink(link.id, fixture.teacher.id, NOW)).rejects.toThrow("ders oluştu");

    // Ders bitince hakediş yazılmaz
    await completeFinishedLessons(hoursAfter(booking.endAt, 1));
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("COMPLETED");
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it("serbest yetkili öğretmen (koç) gerekçesiz açar; bağlantıyı ilk giriş yapan öğrenci alır", async () => {
    const fixture = await createFixture();
    await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { freeLessonLinks: true } });
    const student = await fixture.createStudent();
    const second = await fixture.createStudent();

    const link = await createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "10:00"), durationMinutes: 45, offeringId: "genel" }, NOW);
    expect(link.sourceBookingId).toBeNull();
    await expect(createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "10:30"), durationMinutes: 30, offeringId: fixture.offering.id }, NOW)).rejects.toThrow("başka bir dersiniz");

    const booking = await claimLessonLink(link.token, student.id, NOW);
    expect(booking).toMatchObject({ studentId: student.id, durationMinutes: 45, price: 0, status: "CONFIRMED" });
    await expect(claimLessonLink(link.token, second.id, NOW)).rejects.toThrow("başka bir hesapla");

    // Öğretmen hesabı bağlantıyla derse kaydolamaz
    const own = await createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "12:00"), durationMinutes: 60, offeringId: fixture.offering.id }, NOW);
    await expect(claimLessonLink(own.token, fixture.teacher.id, NOW)).rejects.toThrow("öğrenci/veli hesabıyla");
  });

  it("iptal edilen ya da saati geçen bağlantı kullanılamaz; iptal edilen bağlantı saati boşaltır", async () => {
    const fixture = await createFixture();
    await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { freeLessonLinks: true } });
    const student = await fixture.createStudent();

    const cancelled = await createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "14:00"), durationMinutes: 60 }, NOW);
    await cancelLessonLink(cancelled.id, fixture.teacher.id, NOW);
    await expect(claimLessonLink(cancelled.token, student.id, NOW)).rejects.toThrow("iptal etti");
    await createBookingHold({ studentId: student.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, "14:00"), durationMinutes: 60, mode: "ONLINE", learnerName: "Veli" }, NOW);

    const late = await createLessonLink({ teacherId: fixture.teacher.id, startAt: at(LESSON_DAY, "09:00"), durationMinutes: 60 }, NOW);
    await expect(claimLessonLink(late.token, student.id, hoursAfter(late.endAt, 1))).rejects.toThrow("süresi doldu");
    await expect(createLessonLink({ teacherId: fixture.teacher.id, startAt: hoursAfter(NOW, -2), durationMinutes: 60 }, NOW)).rejects.toThrow("geçmişte");
  });
});

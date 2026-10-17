import { afterAll, describe, expect, it } from "vitest";
import { moduleEnabled, moduleForPath } from "@/lib/center/modules";
import { approveBooking, BookingError, completeFinishedLessons, createBookingHold } from "@/server/bookings";
import { reportClassroom, resolveClassroomReport } from "@/server/classroom-reports";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { loadThread, MessageError, messageTeacher, sendMessage, unreadThreadCount } from "@/server/messages";
import { nextPayoutDay, parsePayoutDays } from "@/server/pricing";
import { reviewEligibility } from "@/server/reviews";
import { deviceOf, normalizePath, recordPageView, referrerHost, statsSummary } from "@/server/stats";
import { checkCriminalRecord } from "@/server/teacher-documents";
import { at, createFixture, hoursAfter, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

const DAY = 86_400_000;

describe("kurum modülleri", () => {
  it("kapalı modül adresten bulunur", () => {
    expect(moduleForPath("/kurum/kocluk")).toBe("kocluk");
    expect(moduleForPath("/kurum/denemeler/abc/karne/x")).toBe("denemeler");
    expect(moduleForPath("/kurum/ogrenciler")).toBeNull();
    expect(moduleEnabled({ disabledModules: ["kocluk"] }, "kocluk")).toBe(false);
    expect(moduleEnabled({ disabledModules: [] }, "muhasebe")).toBe(true);
  });
});

describe("adli sicil kuralı", () => {
  it("son 30 gün içinde alınmış ve barkodlu olmalı", () => {
    expect(checkCriminalRecord({ issuedAt: new Date(NOW.getTime() - 5 * DAY), barcode: "ABCD12345678" }, NOW)).toBeNull();
    expect(checkCriminalRecord({ issuedAt: new Date(NOW.getTime() - 40 * DAY), barcode: "ABCD12345678" }, NOW)).toMatch(/30 gün/);
    expect(checkCriminalRecord({ issuedAt: new Date(NOW.getTime() + 3 * DAY), barcode: "ABCD12345678" }, NOW)).toMatch(/bugünden sonra/);
    expect(checkCriminalRecord({ issuedAt: new Date(NOW.getTime() - DAY), barcode: "" }, NOW)).toMatch(/barkod/);
    expect(checkCriminalRecord({ issuedAt: null, barcode: "ABCD12345678" }, NOW)).toMatch(/tarih/);
  });
});

describe("öğretmen ödeme günleri", () => {
  it("bugün ya da sonraki ödeme günü bulunur", () => {
    const days = parsePayoutDays("15, 1, 40, x");
    expect(days).toEqual([1, 15]);
    expect(nextPayoutDay("2026-10-15", days)).toBe("2026-10-15");
    expect(nextPayoutDay("2026-10-16", days)).toBe("2026-11-01");
    expect(nextPayoutDay("2026-12-20", days)).toBe("2027-01-01");
    expect(nextPayoutDay("2026-10-16", [])).toBeNull();
  });
});

describe("ücretsiz tanışma görüşmesi", () => {
  it("ödemesiz öğretmen onayına düşer; hakediş, yorum ve ders sayısına girmez; aynı öğretmenle bir kez", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const input = { studentId: student.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, "10:00"), durationMinutes: 15, mode: "ONLINE" as const, learnerName: "Ali", intro: true };

    // Öğretmen sunmuyorsa olmaz
    await expect(createBookingHold(input, NOW)).rejects.toBeInstanceOf(BookingError);
    await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { offersIntro: true } });
    await expect(createBookingHold({ ...input, durationMinutes: 60 }, NOW)).rejects.toThrow(/15 dakika/);

    const booking = await createBookingHold(input, NOW);
    expect(booking).toMatchObject({ status: "PENDING_APPROVAL", isIntro: true, price: 0, teacherAmount: 0, serviceName: "Ücretsiz tanışma", holdExpiresAt: null });
    expect(booking.approvalDeadline).not.toBeNull();
    expect(await db.notification.count({ where: { userId: fixture.teacher.id, title: "Ücretsiz tanışma görüşmesi talebi" } })).toBe(1);

    // İkinci tanışma aynı öğretmenle olmaz
    await expect(createBookingHold({ ...input, startAt: at(LESSON_DAY, "12:00") }, NOW)).rejects.toThrow(/zaten/);

    await approveBooking(booking.id, fixture.teacher.id, hoursAfter(NOW, 1));
    await completeFinishedLessons(hoursAfter(booking.endAt, 0.2));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("COMPLETED");
    expect((await db.teacherProfile.findUniqueOrThrow({ where: { userId: fixture.teacher.id } })).completedLessons).toBe(0);
    expect(await teacherBalances(fixture.teacher.id)).toEqual({ pending: 0, available: 0, paid: 0 });
    expect((await reviewEligibility(student.id, fixture.teacher.id, hoursAfter(booking.endAt, 1))).eligible).toBe(false);
    expect(await db.notification.count({ where: { userId: student.id, type: "booking.intro_completed" } })).toBe(1);
  });
});

describe("derste uygunsuz durum bildirimi", () => {
  it("öğrenci bildirince öğretmen askıya alınır; yönetici yeniden yayına alabilir", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { offersIntro: true } });
    const booking = await createBookingHold({ studentId: student.id, offeringId: fixture.offering.id, startAt: at(LESSON_DAY, "15:00"), durationMinutes: 15, mode: "ONLINE", learnerName: "Ece", intro: true }, NOW);
    const admin = await db.user.create({ data: { role: "ADMIN", username: `admin.r.${booking.id}`, firstName: "A", lastName: "B", passwordHash: "x" } });

    await expect(reportClassroom(booking.id, student.id, "Uydurma neden", null)).rejects.toThrow(/neden/);
    const report = await reportClassroom(booking.id, student.id, "Uygunsuz görüntü", "Kamerada uygunsuz görüntü vardı");
    expect(report.teacherSuspended).toBe(true);
    expect((await db.teacherProfile.findUniqueOrThrow({ where: { userId: fixture.teacher.id } })).status).toBe("SUSPENDED");
    expect(await db.notification.count({ where: { userId: admin.id, type: "admin.classroom_report" } })).toBe(1);

    // Başka biri bildirim yapamaz
    const stranger = await fixture.createStudent();
    await expect(reportClassroom(booking.id, stranger.id, "Diğer", null)).rejects.toThrow(/bulunamadı/);

    await resolveClassroomReport(admin.id, report.id, true, "Veliyle ve öğretmenle görüşüldü; yanlış anlaşılma.");
    expect((await db.teacherProfile.findUniqueOrThrow({ where: { userId: fixture.teacher.id } })).status).toBe("PUBLISHED");
  });
});

describe("mesajlaşma", () => {
  it("iletişim bilgileri gizlenir, cevapsız en fazla 3 mesaj, okunmamış sayısı", async () => {
    const fixture = await createFixture();
    const student = await fixture.createStudent();
    const thread = await messageTeacher(student.id, fixture.teacher.id, "Merhaba hocam, numaram 0532 123 45 67, bana yazın", NOW);
    const first = await db.directMessage.findFirstOrThrow({ where: { threadId: thread.id } });
    expect(first.body).not.toContain("0532");
    expect(first.masked).toBe(true);
    expect(await unreadThreadCount(fixture.teacher.id, "teacher")).toBe(1);

    await sendMessage(thread.id, { id: student.id, role: "STUDENT" }, "İkinci mesaj", hoursAfter(NOW, 0.1));
    await sendMessage(thread.id, { id: student.id, role: "STUDENT" }, "Üçüncü mesaj", hoursAfter(NOW, 0.2));
    await expect(sendMessage(thread.id, { id: student.id, role: "STUDENT" }, "Dördüncü", hoursAfter(NOW, 0.3))).rejects.toBeInstanceOf(MessageError);

    await loadThread(thread.id, fixture.teacher.id, hoursAfter(NOW, 0.4));
    expect(await unreadThreadCount(fixture.teacher.id, "teacher")).toBe(0);
    await sendMessage(thread.id, { id: fixture.teacher.id, role: "TEACHER" }, "Merhaba, haftada iki ders öneririm.", hoursAfter(NOW, 0.5));
    await sendMessage(thread.id, { id: student.id, role: "STUDENT" }, "Teşekkürler", hoursAfter(NOW, 0.6));

    // Konuşmanın tarafı olmayan yazamaz
    const other = await fixture.createStudent();
    await expect(sendMessage(thread.id, { id: other.id, role: "STUDENT" }, "Selam", NOW)).rejects.toBeInstanceOf(MessageError);
  });
});

describe("çerezsiz istatistik", () => {
  it("yol, cihaz ve kaynak sadeleşir; botlar ve kişiye özel sayfalar sayılmaz", async () => {
    expect(normalizePath("/ogretmenler?q=matematik")).toBe("/ogretmenler");
    expect(normalizePath("/odeme/test/abc")).toBeNull();
    expect(normalizePath("/api/x")).toBeNull();
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile")).toBe("mobile");
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
    expect(referrerHost("https://www.google.com/search?q=x", "pikampus.com")).toBe("google.com");
    expect(referrerHost("https://pikampus.com/ogretmenler", "pikampus.com")).toBeNull();

    const when = new Date("2031-03-03T10:00:00Z");
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";
    const path = `/test-istatistik-${when.getTime()}`;
    await recordPageView({ path, referrer: "https://google.com/", userAgent: ua, ip: "1.2.3.4", ownHost: "pikampus.com" }, when);
    await recordPageView({ path, referrer: null, userAgent: ua, ip: "1.2.3.4", ownHost: "pikampus.com" }, when);
    await recordPageView({ path, referrer: null, userAgent: "Googlebot/2.1", ip: "5.6.7.8", ownHost: "pikampus.com" }, when);
    const rows = await db.pageView.findMany({ where: { path } });
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.visitor)).size).toBe(1);
    const summary = await statsSummary(1, when);
    expect(summary.pages.find((p) => p.path === path)?.views).toBe(2);
    await db.pageView.deleteMany({ where: { path } });
  });
});

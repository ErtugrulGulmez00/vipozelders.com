import { afterAll, describe, expect, it } from "vitest";
import { addDaysToDateString, toLocalDateString } from "@/lib/dates";
import { completeCheckout, getTeacherSlots } from "@/server/bookings";
import { db } from "@/server/db";
import {
  buildSchedule,
  cancelEnrollment,
  createGroupCourse,
  enrollInGroup,
  GroupError,
  inviteToGroup,
  processGroups,
  sessionShare,
  startGroupCheckout,
  type CourseInput,
} from "@/server/groups";
import { teacherBalances } from "@/server/ledger";
import { createFixture, hoursAfter, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

const DAY = 24;
const START_DAY = addDaysToDateString(toLocalDateString(NOW), 7); // 14 Ocak 2030 Pazartesi

async function courseFixture(overrides: Partial<CourseInput> = {}) {
  const fixture = await createFixture();
  const input: CourseInput = {
    levelId: fixture.offering.levelId,
    subjectId: fixture.offering.subjectId,
    title: "LGS Matematik Kampı",
    description: "Telefon: 0532 123 45 67",
    priceTl: 1000,
    capacity: 10,
    minParticipants: 4,
    enrollDeadline: hoursAfter(NOW, 3 * DAY),
    isPublic: true,
    // 2 hafta, Salı ve Perşembe 19:00, 60 dk → 4 oturum
    schedule: { firstDate: START_DAY, weekdays: [2, 4], startMinute: 19 * 60, durationMinutes: 60, weeks: 2 },
    ...overrides,
  };
  const course = await createGroupCourse(fixture.teacher.id, input, NOW);
  return { ...fixture, course, input };
}

async function payFor(studentId: string, courseId: string, now = NOW) {
  const enrollment = await enrollInGroup(studentId, courseId, "Ali", now);
  await startGroupCheckout(enrollment.id, studentId, "127.0.0.1");
  const payment = await db.payment.findFirstOrThrow({ where: { groupEnrollmentId: enrollment.id }, orderBy: { createdAt: "desc" } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  const result = await completeCheckout(payment.providerToken!, now);
  return { enrollment: await db.groupEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } }), result };
}

async function students(f: Awaited<ReturnType<typeof courseFixture>>, count: number) {
  return Promise.all(Array.from({ length: count }, () => f.createStudent()));
}

describe("grup dersi programı", () => {
  it("haftalık programdan oturumlar oluşur; iletişim bilgisi gizlenir", async () => {
    expect(buildSchedule({ firstDate: START_DAY, weekdays: [2, 4], startMinute: 19 * 60, durationMinutes: 60, weeks: 2 })).toHaveLength(4);
    const f = await courseFixture();
    const sessions = await db.groupSession.findMany({ where: { courseId: f.course.id }, orderBy: { index: "asc" } });
    expect(sessions.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(f.course.description).not.toContain("0532");
    expect(f.course.commissionRateBps).toBe(2000);
  });

  it("kontenjan 4–10 arasında, en az katılımcı en az 4 olmalı; kayıt bitişi ilk oturumdan önce olmalı", async () => {
    await expect(courseFixture({ capacity: 11 })).rejects.toThrow(/Kontenjan/);
    await expect(courseFixture({ capacity: 6, minParticipants: 3 })).rejects.toThrow(/En az katılımcı/);
    await expect(courseFixture({ enrollDeadline: hoursAfter(NOW, 30 * DAY) })).rejects.toThrow(/ilk oturumdan/);
  });

  it("grup oturumu öğretmenin takvimini doldurur; çakışan ikinci program açılamaz", async () => {
    const f = await courseFixture();
    const day = await getTeacherSlots(f.teacher.id, { durationMinutes: 60, startDate: addDaysToDateString(START_DAY, 1), days: 1 }, NOW);
    // 19:00 İstanbul = 16:00 UTC
    const at19 = day[0].slots.find((s) => new Date(s.start).toISOString() === "2030-01-15T16:00:00.000Z");
    expect(at19?.available).toBe(false);
    await expect(createGroupCourse(f.teacher.id, f.input, NOW)).rejects.toThrow(/başka bir dersiniz/);
  });
});

describe("kayıt ve ödeme", () => {
  it("%20 komisyon: 1.000 ₺ kayıttan öğretmene 800 ₺ bekleyen hakediş; kontenjan dolunca kayıt alınmaz", async () => {
    const f = await courseFixture({ capacity: 4 });
    const list = await students(f, 5);
    for (const s of list.slice(0, 4)) {
      const { result, enrollment } = await payFor(s.id, f.course.id);
      expect(result.outcome).toBe("paid");
      expect(enrollment).toMatchObject({ status: "PAID", commissionAmount: 20000, teacherAmount: 80000 });
    }
    expect((await teacherBalances(f.teacher.id)).pending).toBe(320000);
    await expect(enrollInGroup(list[4].id, f.course.id, null, NOW)).rejects.toThrow(/Kontenjan doldu/);
  });

  it("davetle açılan derse yalnızca davet edilen kayıt olur", async () => {
    const f = await courseFixture({ isPublic: false });
    const [invited, stranger] = await students(f, 2);
    await expect(enrollInGroup(stranger.id, f.course.id, null, NOW)).rejects.toThrow(/davet/);
    await inviteToGroup(f.teacher.id, f.course.id, invited.email!, NOW);
    const { result } = await payFor(invited.id, f.course.id);
    expect(result.outcome).toBe("paid");
  });
});

describe("kayıt bitişi", () => {
  it("en az katılımcı dolmazsa ders iptal olur, herkese tam iade", async () => {
    const f = await courseFixture();
    const list = await students(f, 3);
    for (const s of list) await payFor(s.id, f.course.id);
    await processGroups(hoursAfter(f.input.enrollDeadline, 1));
    const course = await db.groupCourse.findUniqueOrThrow({ where: { id: f.course.id } });
    expect(course.status).toBe("CANCELLED");
    const enrollments = await db.groupEnrollment.findMany({ where: { courseId: f.course.id } });
    expect(enrollments.every((e) => e.status === "CANCELLED" && e.refundedAmount === 100000)).toBe(true);
    expect(await db.refund.count({ where: { payment: { groupEnrollment: { courseId: f.course.id } } } })).toBe(3);
    expect((await teacherBalances(f.teacher.id)).pending).toBe(0);
  });

  it("en az katılımcı dolunca kesinleşir; her oturum yapıldıkça o oturumun payı serbest kalır", async () => {
    const f = await courseFixture();
    const list = await students(f, 4);
    for (const s of list) await payFor(s.id, f.course.id);
    await processGroups(hoursAfter(f.input.enrollDeadline, 1));
    expect((await db.groupCourse.findUniqueOrThrow({ where: { id: f.course.id } })).status).toBe("CONFIRMED");

    const first = await db.groupSession.findFirstOrThrow({ where: { courseId: f.course.id, index: 0 } });
    await processGroups(hoursAfter(first.endAt, 1));
    const done = await db.groupSession.findUniqueOrThrow({ where: { id: first.id } });
    expect(done.status).toBe("COMPLETED");
    await processGroups(new Date(done.earningsReleaseAt!.getTime() + 60_000));
    // Aktarım süresi dolduğunda (ödemeden 15 gün sonra) ilk iki oturum yapılmış olur: ikisinin payı serbest
    const released = sessionShare(80000, 4, 0) + sessionShare(80000, 4, 1);
    expect(await teacherBalances(f.teacher.id)).toMatchObject({ available: released * 4, pending: (80000 - released) * 4 });
  });

  it("öğretmen oturuma katılmazsa o oturumun ücreti öğrencilere iade edilir", async () => {
    const f = await courseFixture();
    const list = await students(f, 4);
    for (const s of list) await payFor(s.id, f.course.id);
    await processGroups(hoursAfter(f.input.enrollDeadline, 1));
    const first = await db.groupSession.findFirstOrThrow({ where: { courseId: f.course.id, index: 0 } });
    // Sanal sınıf ayarlıyken yoklamada öğretmen yoksa "katılmadı" sayılır
    const env = { url: process.env.LIVEKIT_URL, key: process.env.LIVEKIT_API_KEY, secret: process.env.LIVEKIT_API_SECRET };
    Object.assign(process.env, { LIVEKIT_URL: "wss://test", LIVEKIT_API_KEY: "k", LIVEKIT_API_SECRET: "s" });
    try {
      await processGroups(hoursAfter(first.endAt, 1));
    } finally {
      Object.assign(process.env, { LIVEKIT_URL: env.url ?? "", LIVEKIT_API_KEY: env.key ?? "", LIVEKIT_API_SECRET: env.secret ?? "" });
    }
    expect((await db.groupSession.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("TEACHER_NO_SHOW");
    const enrollments = await db.groupEnrollment.findMany({ where: { courseId: f.course.id } });
    expect(enrollments.every((e) => e.refundedAmount === sessionShare(100000, 4, 0))).toBe(true);
    expect((await teacherBalances(f.teacher.id)).pending).toBe((80000 - sessionShare(80000, 4, 0)) * 4);
  });
});

describe("öğrenci iptali", () => {
  it("ilk oturumdan önce tam iade; ders başladıktan sonra iptal yok", async () => {
    const f = await courseFixture();
    const [a, b] = await students(f, 2);
    const { enrollment } = await payFor(a.id, f.course.id);
    await cancelEnrollment(a.id, enrollment.id, hoursAfter(NOW, DAY));
    expect(await db.groupEnrollment.findUniqueOrThrow({ where: { id: enrollment.id } })).toMatchObject({ status: "CANCELLED", refundedAmount: 100000 });

    const second = await payFor(b.id, f.course.id);
    const first = await db.groupSession.findFirstOrThrow({ where: { courseId: f.course.id, index: 0 } });
    await expect(cancelEnrollment(b.id, second.enrollment.id, hoursAfter(first.startAt, 0.5))).rejects.toThrow(GroupError);
  });
});

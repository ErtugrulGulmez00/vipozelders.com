import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { dateStringToDbDate, zonedDateTime } from "@/lib/dates";
import { coachFeatureOpen, type CoachPlan } from "@/lib/pi-koc";
import type { CenterContext } from "@/server/center/context";
import { db } from "@/server/db";
import { freeAiLeft, sendCoachAutoReports } from "@/server/koc-report";
import { addInquiryToCoach, InquiryError, respondInquiry, submitInquiry } from "@/server/teacher-inquiries";
import { createBookingHold } from "@/server/bookings";
import { saveSettings } from "@/server/settings";
import { createFixture } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

const plan = (paid: boolean): CoachPlan => ({ state: paid ? "paid" : "free", paid, studentLimit: paid ? 10 : 3, paidLimit: 10, endsAt: null, daysLeft: null });

describe("ücretli özellik kilidi", () => {
  it("ücretsiz pakette kilitli, ücretli pakette ve kurumda açık", () => {
    expect(coachFeatureOpen(plan(false), "pdfImport")).toBe(false);
    expect(coachFeatureOpen(plan(true), "pdfImport")).toBe(true);
    expect(coachFeatureOpen(null, "fees")).toBe(true);
  });

  it("ücretsiz pakette ayda 1 yapay zekâ hakkı; ücretlide sınır yok", async () => {
    const id = randomUUID().slice(0, 8);
    const center = await db.center.create({ data: { name: `Koç ${id}`, slug: `koc-${id}`, kind: "COACH", status: "ACTIVE", studentLimit: 10 } });
    const free = { center: { id: center.id }, coach: plan(false) } as unknown as CenterContext;
    expect(await freeAiLeft(free)).toBe(1);
    await db.loginAttempt.create({ data: { identifier: `ai-free:${center.id}`, success: false } });
    expect(await freeAiLeft(free)).toBe(0);
    expect(await freeAiLeft({ ...free, coach: plan(true) } as CenterContext)).toBeNull();
  });
});

describe("otomatik haftalık veli raporu", () => {
  it("pazar 18:00'den sonra ücretli koçun kaydı olan öğrencisine bir kez gider; boş hafta ve ücretsiz koç atlanır", async () => {
    const id = randomUUID().slice(0, 8);
    const sunday = "2026-11-15";
    const now = zonedDateTime(sunday, 19 * 60);
    const make = async (paid: boolean, suffix: string) => {
      const center = await db.center.create({
        data: { name: `Koç ${id}${suffix}`, slug: `koc-${id}${suffix}`, kind: "COACH", status: "ACTIVE", studentLimit: 10, coachAutoReport: true, paidUntil: paid ? new Date(now.getTime() + 20 * 86_400_000) : null },
      });
      const busy = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ece", lastName: id } });
      const idle = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Can", lastName: id } });
      for (const s of [busy, idle]) await db.centerGuardian.create({ data: { centerId: center.id, studentId: s.id, fullName: "Veli Kişi", relation: "Anne", email: `veli.${s.id}@example.com`, isPrimary: true } });
      await db.centerQuestionLog.create({ data: { centerId: center.id, studentId: busy.id, date: dateStringToDbDate("2026-11-12"), subject: "Matematik", solved: 40, correct: 30, wrong: 10 } });
      return { center, busy, idle };
    };
    const paid = await make(true, "p");
    const free = await make(false, "f");

    // Cumartesi ya da pazar 18:00'den önce çalışmaz
    expect(await sendCoachAutoReports(zonedDateTime(sunday, 17 * 60))).toBe(0);
    await sendCoachAutoReports(now);
    const sent = await db.centerWeeklyReport.findMany({ where: { centerId: { in: [paid.center.id, free.center.id] }, sentAt: { not: null } } });
    expect(sent.map((r) => r.studentId)).toEqual([paid.busy.id]);
    // Aynı hafta ikinci kez gitmez
    await sendCoachAutoReports(new Date(now.getTime() + 60_000));
    expect(await db.centerWeeklyReport.count({ where: { centerId: paid.center.id, sentAt: { not: null } } })).toBe(1);
  });
});

describe("vitrinden ders talebi", () => {
  it("randevu kapalıyken yeni randevu açılmaz", async () => {
    const { offering, createStudent } = await createFixture();
    const student = await createStudent();
    await saveSettings({ lessonBookingEnabled: false });
    try {
      await expect(
        createBookingHold({ studentId: student.id, offeringId: offering.id, startAt: new Date(Date.now() + 3 * 86_400_000), durationMinutes: 60, mode: "ONLINE", learnerName: "Deniz" } as Parameters<typeof createBookingHold>[0]),
      ).rejects.toThrow(/ders talebi/);
    } finally {
      await saveSettings({ lessonBookingEnabled: true });
    }
  });

  it("veli talep gönderir, ikinci bekleyen talep reddedilir; öğretmen kabul edince veliye haber gider", async () => {
    const fixture = await createFixture();
    const teacher = { userId: fixture.teacher.id, offerings: [{ id: fixture.offering.id }] };
    const id = randomUUID().slice(0, 8);
    const parent = await db.user.create({ data: { role: "STUDENT", username: `veli.${id}`, email: `veli.${id}@example.com`, firstName: "Ayten", lastName: "Kaya", passwordHash: "x" } });
    const input = { teacherId: teacher!.userId, name: "Ayten Kaya", phone: "0532 111 22 33", studentName: "Deniz", gradeName: "8. sınıf", offeringId: teacher!.offerings[0]?.id, mode: "online" as const, preferredTimes: "Hafta içi akşam, 0533 999 88 77", note: "LGS matematik" };
    const inquiry = await submitInquiry(input, { id: parent.id, email: parent.email }, null);
    expect(inquiry).toMatchObject({ status: "PENDING", phone: "05321112233" });
    // Serbest metindeki numara gizlenir
    expect(inquiry.preferredTimes).not.toContain("999 88 77");
    await expect(submitInquiry(input, { id: parent.id, email: parent.email }, null)).rejects.toBeInstanceOf(InquiryError);

    await respondInquiry(teacher!.userId, inquiry.id, true);
    expect((await db.teacherInquiry.findUniqueOrThrow({ where: { id: inquiry.id } })).status).toBe("ACCEPTED");
    expect(await db.notification.count({ where: { userId: parent.id, type: "inquiry.accepted" } })).toBe(1);
    await expect(respondInquiry(teacher!.userId, inquiry.id, false)).rejects.toBeInstanceOf(InquiryError);

    // Adım 5: öğrenci öğretmenin Pi Koç'una düşer; hesabı yoksa ücretsiz açılır, veli hesabı bağlanır
    const link = await addInquiryToCoach(teacher!.userId, inquiry.id);
    expect(link).toMatchObject({ added: true, createdCoach: true });
    const student = await db.centerStudent.findUniqueOrThrow({ where: { id: link.added ? link.studentId : "" }, include: { center: true, guardians: true } });
    expect(student).toMatchObject({ firstName: "Deniz", lastName: "Kaya", gradeName: "8. sınıf" });
    expect(student.center.kind).toBe("COACH");
    expect(student.guardians[0]).toMatchObject({ userId: parent.id, phone: "05321112233", isStudentAccount: false });
    expect(await db.notification.count({ where: { userId: parent.id, type: "inquiry.coach_linked" } })).toBe(1);
    // Tekrar çağrı yeni öğrenci açmaz
    expect(await addInquiryToCoach(teacher!.userId, inquiry.id)).toMatchObject({ added: true, studentId: student.id, createdCoach: false });

    // Ücretsiz paket (3 öğrenci) dolunca öğrenci eklenmez, kabul geçerli kalır
    await db.centerStudent.createMany({ data: ["A", "B"].map((n) => ({ centerId: student.centerId, firstName: n, lastName: id })) });
    const other = await db.user.create({ data: { role: "STUDENT", username: `veli2.${id}`, email: `veli2.${id}@example.com`, firstName: "Can", lastName: "Er", passwordHash: "x" } });
    const second = await submitInquiry({ ...input, name: "Can Er" }, { id: other.id, email: other.email }, null);
    await respondInquiry(teacher!.userId, second.id, true);
    const full = await addInquiryToCoach(teacher!.userId, second.id);
    expect(full).toMatchObject({ added: false });
    expect((await db.teacherInquiry.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("ACCEPTED");
  });
});

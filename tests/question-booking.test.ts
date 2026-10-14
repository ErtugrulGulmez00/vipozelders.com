import { afterAll, describe, expect, it } from "vitest";
import { completeCheckout, expireOverdueApprovals, getTeacherSlots, startCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { addQuestionMessage, createQuestionHold } from "@/server/question-bookings";
import { createFixture, hoursAfter, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

// 1x1 PNG
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const photo = () => new File([PNG], "soru.png", { type: "image/png" });

async function questionFixture() {
  const fixture = await createFixture();
  await db.teacherOffering.update({ where: { id: fixture.offering.id }, data: { questionPrice: 15000 } });
  const student = await fixture.createStudent();
  return { ...fixture, student };
}

async function askAndPay(fixture: Awaited<ReturnType<typeof questionFixture>>) {
  const booking = await createQuestionHold({ studentId: fixture.student.id, offeringId: fixture.offering.id, learnerName: "Ali", note: "3. adımı anlamadım", image: photo() }, NOW);
  await startCheckout(booking.id, fixture.student.id, "127.0.0.1", NOW);
  const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  const result = await completeCheckout(payment.providerToken!, NOW);
  return { booking, result };
}

describe("fotoğrafla soru", () => {
  it("ödeme → çözüm bekleniyor → öğretmen çözümü gönderir → hakediş", async () => {
    const fixture = await questionFixture();
    const { booking, result } = await askAndPay(fixture);
    expect(result.outcome).toBe("paid");
    expect(booking.mode).toBe("QUESTION");
    expect(booking.price).toBe(15000);

    let fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("PENDING_APPROVAL");
    expect(fresh.approvalDeadline).toEqual(hoursAfter(NOW, 24));

    // Soru öğretmenin takvimini doldurmaz
    const days = await getTeacherSlots(fixture.teacher.id, { durationMinutes: 60, startDate: LESSON_DAY, days: 1 }, NOW);
    expect(days[0].slots.every((s) => s.available)).toBe(true);

    // Öğrenci ek mesaj yazar, öğretmen çözümü gönderir
    await addQuestionMessage(booking.id, { id: fixture.student.id, role: "STUDENT" }, { body: "Şıklar da fotoğrafta", image: null, video: null, isSolution: false }, NOW);
    const solved = await addQuestionMessage(booking.id, { id: fixture.teacher.id, role: "TEACHER" }, { body: "Önce iki tarafı 2 ile çarpıyoruz…", image: photo(), video: null, isSolution: true }, NOW);
    expect(solved.solved).toBe(true);

    fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("COMPLETED");
    expect(fresh.answeredAt).toEqual(NOW);
    expect(fresh.earningsReleaseAt).toEqual(hoursAfter(NOW, 48));
    expect((await teacherBalances(fixture.teacher.id)).pending).toBe(fresh.teacherAmount);
    expect(await db.bookingMessage.count({ where: { bookingId: booking.id } })).toBe(3);
    const notes = await db.notification.findMany({ where: { userId: fixture.student.id } });
    expect(notes.map((n) => n.type)).toContain("question.solved");
  });

  it("çözüm süresinde gelmezse tam iade", async () => {
    const fixture = await questionFixture();
    const { booking } = await askAndPay(fixture);
    await expireOverdueApprovals(hoursAfter(NOW, 25));
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.status).toBe("EXPIRED");
    expect(fresh.refundedAmount).toBe(15000);
  });

  it("başkası yazamaz, öğrenci video ekleyemez, soru ücreti yoksa soru alınmaz", async () => {
    const fixture = await questionFixture();
    const { booking } = await askAndPay(fixture);
    const other = await fixture.createStudent();
    await expect(addQuestionMessage(booking.id, { id: other.id, role: "STUDENT" }, { body: "merhaba", image: null, video: null, isSolution: false })).rejects.toThrow("Soru bulunamadı");
    await expect(
      addQuestionMessage(booking.id, { id: fixture.student.id, role: "STUDENT" }, { body: null, image: null, video: new File([PNG], "a.mp4"), isSolution: false }),
    ).rejects.toThrow("Video yalnızca");
    await db.teacherOffering.update({ where: { id: fixture.offering.id }, data: { questionPrice: null } });
    await expect(createQuestionHold({ studentId: fixture.student.id, offeringId: fixture.offering.id, learnerName: "Ali", image: photo() })).rejects.toThrow("fotoğrafla soru kabul etmiyor");
  });
});

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { formatHours, meetingAllowance, meetingMinutes, meetingPolicy, type CoachPlan } from "@/lib/pi-koc";
import { db } from "@/server/db";
import { coachMeetingAllowance, coachMeetingUsage, enforceCoachMeetings, handleCoachRoomEvent } from "@/server/koc-meeting-usage";

afterAll(async () => {
  await db.$disconnect();
});

const SETTINGS = { piKocFreeStudents: 3, piKocHoursPerStudent: 4, piKocFreeMeetingMinutes: 40 };
const plan = (paid: boolean, paidLimit = 10): CoachPlan => ({ state: paid ? "paid" : "free", paid, studentLimit: paid ? paidLimit : 3, paidLimit, endsAt: null, daysLeft: null });
const min = (n: number) => n * 60_000;

describe("görüşme kuralları (saf)", () => {
  it("ücretsiz: 3 × 4 = 12 saat havuz, görüşme başına 40 dk, sert sınır", () => {
    const policy = meetingPolicy(plan(false), SETTINGS);
    expect(policy).toEqual({ poolMinutes: 720, hard: true, maxMeetingMinutes: 40 });
    expect(meetingAllowance(policy, 0)).toEqual({ ok: true, minutes: 40, overPool: false });
    // Havuzun sonu: kalan süre kadar
    expect(meetingAllowance(policy, 700)).toEqual({ ok: true, minutes: 20, overPool: false });
    expect(meetingAllowance(policy, 720)).toMatchObject({ ok: false });
  });

  it("ücretli: paket öğrenci sayısı × 4 saat, süre serbest, havuz aşılsa da girilir", () => {
    const policy = meetingPolicy(plan(true, 10), SETTINGS);
    expect(policy).toEqual({ poolMinutes: 2400, hard: false, maxMeetingMinutes: null });
    expect(meetingAllowance(policy, 2500)).toMatchObject({ ok: true, overPool: true });
  });

  it("aylık toplam: açık görüşme şu ana kadar, ay başından önceki kısım sayılmaz", () => {
    const monthStart = new Date("2026-11-01T00:00:00Z");
    const now = new Date("2026-11-12T12:00:00Z");
    const total = meetingMinutes(
      [
        { startedAt: new Date("2026-10-31T23:30:00Z"), endedAt: new Date("2026-11-01T00:30:00Z") },
        { startedAt: new Date("2026-11-05T10:00:00Z"), endedAt: new Date("2026-11-05T10:45:00Z") },
        { startedAt: new Date("2026-11-12T11:40:00Z"), endedAt: null },
      ],
      monthStart,
      now,
    );
    expect(total).toBe(30 + 45 + 20);
    expect(formatHours(750)).toBe("12 sa 30 dk");
    expect(formatHours(720)).toBe("12 saat");
  });
});

async function coachWithStudent(paid: boolean) {
  const id = randomUUID().slice(0, 8);
  const center = await db.center.create({
    data: { name: `Koç ${id}`, slug: `koc-${id}`, kind: "COACH", status: "ACTIVE", studentLimit: 10, paidUntil: paid ? new Date(Date.now() + 30 * 86_400_000) : null },
  });
  const student = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ece", lastName: id } });
  return { center, student, room: `koc-${student.id}` };
}

describe("görüşme kaydı ve sınır (veritabanı)", () => {
  it("ilk giren görüşmeyi başlatır, son çıkan bitirir; veli izleyici sayılmaz", async () => {
    const { center, room } = await coachWithStudent(true);
    const t0 = new Date();
    await handleCoachRoomEvent(room, "koc-kullanici", "participant_joined", t0);
    await handleCoachRoomEvent(room, "ogrenci-kullanici", "participant_joined", new Date(t0.getTime() + min(1)));
    await handleCoachRoomEvent(room, "veli:izleyici:ab12", "participant_joined", new Date(t0.getTime() + min(2)));
    await handleCoachRoomEvent(room, "ogrenci-kullanici", "participant_left", new Date(t0.getTime() + min(20)));
    expect(await db.coachMeeting.count({ where: { centerId: center.id, endedAt: null } })).toBe(1);
    await handleCoachRoomEvent(room, "koc-kullanici", "participant_left", new Date(t0.getTime() + min(30)));
    const [m] = await db.coachMeeting.findMany({ where: { centerId: center.id } });
    expect(m).toMatchObject({ free: false, activeCount: 0 });
    expect(m.endedAt!.getTime() - m.startedAt.getTime()).toBe(min(30));
    expect(Math.round(await coachMeetingUsage(center.id, new Date(t0.getTime() + min(60))))).toBe(30);
  });

  it("ücretsizde 40 dakikayı geçen görüşme kapatılır ve 40 dakika sayılır", async () => {
    const { center, room } = await coachWithStudent(false);
    const start = new Date(Date.now() - min(45));
    await handleCoachRoomEvent(room, "koc-kullanici", "participant_joined", start);
    expect((await db.coachMeeting.findFirstOrThrow({ where: { centerId: center.id } })).free).toBe(true);
    await enforceCoachMeetings();
    const m = await db.coachMeeting.findFirstOrThrow({ where: { centerId: center.id } });
    expect(m.endedAt!.getTime() - m.startedAt.getTime()).toBe(min(40));
  });

  it("ücretsizde aylık 12 saat dolunca görüşmeye girilemez; ücretlide girilir", async () => {
    const free = await coachWithStudent(false);
    const paid = await coachWithStudent(true);
    const end = new Date();
    for (const c of [free, paid]) {
      await db.coachMeeting.create({ data: { centerId: c.center.id, studentId: c.student.id, roomName: c.room, startedAt: new Date(end.getTime() - min(721)), endedAt: end } });
    }
    // Ay başına yakın çalışırsa kayıt önceki aya taşabilir; testte kullanımın en az 12 saat olduğu kontrol edilir
    if ((await coachMeetingUsage(free.center.id)) >= 720) {
      expect(await coachMeetingAllowance(free.student.id)).toMatchObject({ ok: false });
    }
    expect(await coachMeetingAllowance(paid.student.id)).toMatchObject({ ok: true, minutes: 120 });
  });
});

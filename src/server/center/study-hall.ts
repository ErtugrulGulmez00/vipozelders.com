import { dateStringToDbDate, dbDateToString } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Çalışma salonu (kütüphane) yoklaması: salonun periyotları (09:00-09:45 …) için öğrenci başına geldi/gelmedi.
// Bir günün işaretleri tek satırda tutulur: her karakter bir periyot (G geldi, Y gelmedi, - işaretlenmedi).

const PERIOD = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

/** "09:00-09:45" satırlarını doğrular ve sıralar. */
export function parsePeriods(text: string): string[] {
  const periods = text
    .split(/[\r\n,]+/)
    .map((p) => p.replace(/\s/g, "").replace("–", "-"))
    .filter(Boolean);
  const invalid = periods.find((p) => !PERIOD.test(p) || p.slice(6) <= p.slice(0, 5));
  if (invalid) throw new CenterError(`Periyot hatalı: “${invalid}”. Örnek: 09:00-09:45`, { periods: "SS:DD-SS:DD" });
  if (!periods.length) throw new CenterError("En az bir periyot yazın.", { periods: "Örn: 09:00-09:45" });
  return [...new Set(periods)].sort().slice(0, 16);
}

export type HallMark = "G" | "Y" | "-";

/** İşaret dizisini periyot sayısına göre düzeltir. */
export function normalizeMarks(marks: string, count: number): string {
  return Array.from({ length: count }, (_, i) => (["G", "Y"].includes(marks[i]) ? marks[i] : "-")).join("");
}

/** Bir günün özeti: geldiği periyot sayısı / işaretlenen periyot sayısı. */
export function markSummary(marks: string) {
  const present = [...marks].filter((m) => m === "G").length;
  const absent = [...marks].filter((m) => m === "Y").length;
  return { present, absent, marked: present + absent };
}

export async function getHallOrThrow(ctx: CenterContext, hallId: string) {
  const hall = await db.centerStudyHall.findFirst({ where: { id: hallId, centerId: ctx.center.id } });
  if (!hall) throw new CenterError("Salon bulunamadı.");
  return hall;
}

export async function createHall(ctx: CenterContext, input: { name: string; periods: string[] }) {
  return db.centerStudyHall.create({ data: { centerId: ctx.center.id, name: input.name, periods: input.periods } });
}

export async function updateHall(ctx: CenterContext, hallId: string, input: { name: string; periods: string[]; isActive: boolean }) {
  await getHallOrThrow(ctx, hallId);
  return db.centerStudyHall.update({ where: { id: hallId }, data: input });
}

export async function deleteHall(ctx: CenterContext, hallId: string) {
  await getHallOrThrow(ctx, hallId);
  await db.centerStudyHall.delete({ where: { id: hallId } });
}

/** Salona öğrenci ekler (sınıf ya da tek tek); zaten kayıtlı olanlar atlanır. */
export async function addHallStudents(ctx: CenterContext, hallId: string, input: { groupId: string | null; studentIds: string[] }) {
  await getHallOrThrow(ctx, hallId);
  if (!input.groupId && !input.studentIds.length) throw new CenterError("Sınıf ya da öğrenci seçin.", { groupId: "Seçin." });
  const students = await db.centerStudent.findMany({
    where: { centerId: ctx.center.id, status: "ACTIVE", OR: [...(input.groupId ? [{ groups: { some: { groupId: input.groupId } } }] : []), ...(input.studentIds.length ? [{ id: { in: input.studentIds } }] : [])] },
    select: { id: true },
  });
  const result = await db.centerHallStudent.createMany({ data: students.map((s) => ({ hallId, studentId: s.id })), skipDuplicates: true });
  return result.count;
}

export async function updateHallStudent(ctx: CenterContext, hallId: string, studentId: string, deskNo: string | null, remove: boolean) {
  await getHallOrThrow(ctx, hallId);
  if (remove) await db.centerHallStudent.delete({ where: { hallId_studentId: { hallId, studentId } } });
  else await db.centerHallStudent.update({ where: { hallId_studentId: { hallId, studentId } }, data: { deskNo } });
}

/**
 * Günün işaretlerini kaydeder. notify: o gün hiçbir periyotta gelmeyen (en az bir periyot işaretli, hepsi Y) öğrencinin
 * velisine bir kez bildirim gider.
 */
export async function saveHallDay(ctx: CenterContext, hallId: string, date: string, rows: { studentId: string; marks: string }[], notify: boolean) {
  const hall = await getHallOrThrow(ctx, hallId);
  const members = new Set((await db.centerHallStudent.findMany({ where: { hallId }, select: { studentId: true } })).map((m) => m.studentId));
  const valid = rows.filter((r) => members.has(r.studentId)).map((r) => ({ ...r, marks: normalizeMarks(r.marks, hall.periods.length) }));
  const day = dateStringToDbDate(date);
  await db.$transaction(
    valid.map((r) =>
      db.centerHallDay.upsert({
        where: { hallId_studentId_date: { hallId, studentId: r.studentId, date: day } },
        create: { hallId, studentId: r.studentId, date: day, marks: r.marks },
        update: { marks: r.marks },
      }),
    ),
  );
  let notified = 0;
  if (notify) {
    const absentAllDay = await db.centerHallDay.findMany({
      where: { hallId, date: day, notifiedAt: null, studentId: { in: valid.filter((r) => { const s = markSummary(r.marks); return s.marked > 0 && s.present === 0; }).map((r) => r.studentId) } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
    const [y, m, d] = date.split("-");
    for (const row of absentAllDay) {
      const name = `${row.student.firstName} ${row.student.lastName}`;
      await messageGuardians({
        centerId: ctx.center.id,
        centerName: ctx.center.name,
        studentId: row.studentId,
        kind: "hall_absence",
        messageTitle: "Çalışma salonu",
        message: `Sayın veli, öğrenciniz ${name} ${d}.${m}.${y} tarihinde ${hall.name} çalışma salonuna gelmemiştir.`,
        notification: { title: `${row.student.firstName} çalışma salonuna gelmedi`, body: `${d}.${m}.${y} · ${hall.name}` },
      });
      await db.centerHallDay.update({ where: { hallId_studentId_date: { hallId, studentId: row.studentId, date: day } }, data: { notifiedAt: new Date() } });
      notified++;
    }
  }
  return { saved: valid.length, notified };
}

/** Tarih aralığında öğrenci bazında salon katılımı (geldiği periyot / işaretlenen periyot). */
export async function hallReport(hallId: string, from: string, to: string) {
  const days = await db.centerHallDay.findMany({
    where: { hallId, date: { gte: dateStringToDbDate(from), lte: dateStringToDbDate(to) } },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
  });
  const byStudent = new Map<string, { name: string; days: number; present: number; marked: number }>();
  for (const day of days) {
    const s = markSummary(day.marks);
    if (!s.marked) continue;
    const row = byStudent.get(day.studentId) ?? { name: `${day.student.firstName} ${day.student.lastName}`, days: 0, present: 0, marked: 0 };
    row.days += s.present ? 1 : 0;
    row.present += s.present;
    row.marked += s.marked;
    byStudent.set(day.studentId, row);
  }
  return [...byStudent.entries()].map(([studentId, r]) => ({ studentId, ...r, rate: r.marked ? r.present / r.marked : 0 })).sort((a, b) => a.rate - b.rate);
}

/** Öğrencinin son günlerdeki salon kayıtları (öğrenci kartı ve veli portalı). */
export async function studentHallDays(studentId: string, take = 14) {
  const days = await db.centerHallDay.findMany({ where: { studentId }, include: { hall: { select: { name: true, periods: true } } }, orderBy: { date: "desc" }, take });
  return days.map((d) => ({ date: dbDateToString(d.date), hall: d.hall.name, periods: d.hall.periods, marks: normalizeMarks(d.marks, d.hall.periods.length), ...markSummary(d.marks) })).filter((d) => d.marked > 0);
}

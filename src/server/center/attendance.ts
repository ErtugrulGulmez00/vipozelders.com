import { dateStringToDbDate, isoWeekday, minutesToTime } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Yoklama: programdaki her ders için grup bazında oturum; gelmeyenlerin velisine bildirim.

export type AttendanceStatusName = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type DayLesson = {
  key: string;
  groupId: string;
  groupName: string;
  slotId: string | null;
  startMinute: number;
  endMinute: number;
  subject: string;
  teacherName: string | null;
  room: string | null;
  studentCount: number;
  session: { id: string; takenAt: Date | null; present: number; absent: number; late: number; excused: number } | null;
};

/** Bir gündeki dersler: haftalık programdan gelenler + o gün elle açılan yoklamalar. */
export async function lessonsForDate(centerId: string, date: string, options: { teacherId?: string } = {}): Promise<DayLesson[]> {
  const weekday = isoWeekday(date);
  const [slots, sessions] = await Promise.all([
    db.centerScheduleSlot.findMany({
      where: { centerId, weekday, group: { isActive: true }, ...(options.teacherId ? { teacherId: options.teacherId } : {}) },
      include: { group: { select: { name: true, _count: { select: { students: { where: { student: { status: "ACTIVE" } } } } } } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startMinute: "asc" },
    }),
    db.centerAttendanceSession.findMany({
      where: { centerId, date: dateStringToDbDate(date), ...(options.teacherId ? { teacherId: options.teacherId } : {}) },
      include: { group: { select: { name: true, _count: { select: { students: { where: { student: { status: "ACTIVE" } } } } } } }, records: { select: { status: true } } },
    }),
  ]);
  const teacherNames = new Map<string, string>();
  const sessionByKey = new Map(sessions.map((s) => [`${s.groupId}:${s.startMinute}`, s]));
  const summarize = (s: (typeof sessions)[number]) => ({
    id: s.id,
    takenAt: s.takenAt,
    present: s.records.filter((r) => r.status === "PRESENT").length,
    absent: s.records.filter((r) => r.status === "ABSENT").length,
    late: s.records.filter((r) => r.status === "LATE").length,
    excused: s.records.filter((r) => r.status === "EXCUSED").length,
  });
  const lessons: DayLesson[] = slots.map((slot) => {
    const key = `${slot.groupId}:${slot.startMinute}`;
    const session = sessionByKey.get(key);
    sessionByKey.delete(key);
    const teacherName = slot.teacher ? `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}` : null;
    if (slot.teacherId && teacherName) teacherNames.set(slot.teacherId, teacherName);
    return {
      key,
      groupId: slot.groupId,
      groupName: slot.group.name,
      slotId: slot.id,
      startMinute: slot.startMinute,
      endMinute: slot.endMinute,
      subject: slot.subject,
      teacherName,
      room: slot.room,
      studentCount: slot.group._count.students,
      session: session ? summarize(session) : null,
    };
  });
  for (const session of sessionByKey.values()) {
    lessons.push({
      key: `${session.groupId}:${session.startMinute}`,
      groupId: session.groupId,
      groupName: session.group.name,
      slotId: session.slotId,
      startMinute: session.startMinute,
      endMinute: session.endMinute,
      subject: session.subject,
      teacherName: session.teacherId ? (teacherNames.get(session.teacherId) ?? null) : null,
      room: null,
      studentCount: session.group._count.students,
      session: summarize(session),
    });
  }
  return lessons.sort((a, b) => a.startMinute - b.startMinute || a.groupName.localeCompare(b.groupName, "tr"));
}

export type AttendanceSheetInput = {
  groupId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  subject: string;
  slotId: string | null;
  /** Sınıf defteri: işlenen konu */
  topic?: string | null;
  records: { studentId: string; status: AttendanceStatusName; note: string | null }[];
  notify: boolean;
};

/** Yoklamayı kaydeder; ilk kez "gelmedi" işaretlenen öğrencilerin velilerine bildirim gider. */
export async function saveAttendance(ctx: CenterContext, input: AttendanceSheetInput) {
  const group = await db.centerGroup.findFirst({ where: { id: input.groupId, centerId: ctx.center.id } });
  if (!group) throw new CenterError("Sınıf bulunamadı.");
  if (input.endMinute <= input.startMinute) throw new CenterError("Ders saati geçersiz.");
  const slot = input.slotId ? await db.centerScheduleSlot.findFirst({ where: { id: input.slotId, groupId: group.id } }) : null;
  const studentIds = new Set(
    (await db.centerStudent.findMany({ where: { centerId: ctx.center.id, id: { in: input.records.map((r) => r.studentId) } }, select: { id: true } })).map((s) => s.id),
  );
  const records = input.records.filter((r) => studentIds.has(r.studentId));
  if (!records.length) throw new CenterError("Yoklama listesinde öğrenci yok.");

  const date = dateStringToDbDate(input.date);
  const session = await db.centerAttendanceSession.upsert({
    where: { groupId_date_startMinute: { groupId: group.id, date, startMinute: input.startMinute } },
    create: {
      centerId: ctx.center.id,
      groupId: group.id,
      slotId: slot?.id ?? null,
      date,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      subject: input.subject || slot?.subject || "Ders",
      teacherId: slot?.teacherId ?? (ctx.member.role === "TEACHER" ? ctx.member.id : null),
      takenById: ctx.member.id,
      takenAt: new Date(),
      topic: input.topic ?? null,
    },
    update: { takenById: ctx.member.id, takenAt: new Date(), endMinute: input.endMinute, subject: input.subject || undefined, ...(input.topic !== undefined ? { topic: input.topic } : {}) },
  });
  await db.$transaction(
    records.map((r) =>
      db.centerAttendance.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: r.studentId } },
        create: { sessionId: session.id, studentId: r.studentId, status: r.status, note: r.note },
        update: { status: r.status, note: r.note },
      }),
    ),
  );

  let notified = 0;
  if (input.notify && ctx.center.notifyAbsence) {
    const absent = await db.centerAttendance.findMany({
      where: { sessionId: session.id, status: "ABSENT", notifiedAt: null },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });
    const [y, m, d] = input.date.split("-");
    const when = `${d}.${m}.${y} ${minutesToTime(input.startMinute)}`;
    for (const record of absent) {
      const name = `${record.student.firstName} ${record.student.lastName}`;
      const counts = await messageGuardians({
        centerId: ctx.center.id,
        centerName: ctx.center.name,
        studentId: record.student.id,
        kind: "absence",
        sms: `Sayın veli, öğrenciniz ${name} ${when} ${session.subject} dersine katılmamıştır.${ctx.center.phone ? ` Bilgi: ${ctx.center.phone}` : ""}`,
        email: {
          subject: `Devamsızlık bilgisi: ${name}`,
          title: "Öğrenciniz derse katılmadı",
          lines: [`${name}, ${when} saatindeki ${session.subject} dersine (${group.name}) katılmamıştır.`, "Bir bilginiz yoksa lütfen kurumumuzla iletişime geçin."],
        },
        notification: { title: `${record.student.firstName} derse katılmadı`, body: `${when} · ${session.subject} (${group.name})` },
      });
      if (counts.sms + counts.email + counts.app > 0) notified++;
      await db.centerAttendance.update({ where: { id: record.id }, data: { notifiedAt: new Date() } });
    }
  }
  return { sessionId: session.id, saved: records.length, notified };
}

export type AbsenceRow = {
  studentId: string;
  name: string;
  studentNumber: string | null;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
};

/** Tarih aralığında öğrenci bazında devam durumu (en çok devamsızlık yapan başta). */
export async function attendanceReport(centerId: string, from: string, to: string, groupId?: string): Promise<AbsenceRow[]> {
  const records = await db.centerAttendance.findMany({
    where: { session: { centerId, date: { gte: dateStringToDbDate(from), lte: dateStringToDbDate(to) }, ...(groupId ? { groupId } : {}) } },
    select: { status: true, student: { select: { id: true, firstName: true, lastName: true, studentNumber: true } } },
  });
  const rows = new Map<string, AbsenceRow>();
  for (const r of records) {
    const row = rows.get(r.student.id) ?? {
      studentId: r.student.id,
      name: `${r.student.firstName} ${r.student.lastName}`,
      studentNumber: r.student.studentNumber,
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      rate: 0,
    };
    row.total++;
    if (r.status === "PRESENT") row.present++;
    else if (r.status === "ABSENT") row.absent++;
    else if (r.status === "LATE") row.late++;
    else row.excused++;
    rows.set(r.student.id, row);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, rate: r.total ? (r.present + r.late) / r.total : 1 }))
    .sort((a, b) => b.absent - a.absent || a.rate - b.rate || a.name.localeCompare(b.name, "tr"));
}

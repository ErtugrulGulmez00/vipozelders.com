import { dateStringToDbDate, minutesToTime } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { WA_TEMPLATES } from "../whatsapp";
import { centerContact, messageGuardians } from "./messages";

// Birebir veya küçük grup etütleri: öğretmen, öğrenciler, saat, ders/konu, katılım.

export type EtudInput = {
  date: string;
  startMinute: number;
  endMinute: number;
  teacherId: string | null;
  subject: string;
  topic: string | null;
  room: string | null;
  notes: string | null;
  studentIds: string[];
};

async function assertNoConflict(ctx: CenterContext, input: EtudInput, ignoreId?: string) {
  const overlapping = await db.centerEtud.findMany({
    where: {
      centerId: ctx.center.id,
      date: dateStringToDbDate(input.date),
      status: { not: "CANCELLED" },
      startMinute: { lt: input.endMinute },
      endMinute: { gt: input.startMinute },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } }, teacher: { include: { user: { select: { firstName: true } } } } },
  });
  for (const etud of overlapping) {
    const when = `${minutesToTime(etud.startMinute)}-${minutesToTime(etud.endMinute)}`;
    if (input.teacherId && etud.teacherId === input.teacherId) throw new CenterError(`${etud.teacher?.user.firstName ?? "Öğretmenin"} ${when} arasında başka bir etüdü var (${etud.subject}).`);
    if (input.room && etud.room && etud.room.toLocaleLowerCase("tr-TR") === input.room.toLocaleLowerCase("tr-TR")) throw new CenterError(`${input.room} ${when} arasında dolu.`);
    const clash = etud.students.find((s) => input.studentIds.includes(s.studentId));
    if (clash) throw new CenterError(`${clash.student.firstName} ${clash.student.lastName} ${when} arasında başka bir etütte (${etud.subject}).`);
  }
}

export async function saveEtud(ctx: CenterContext, etudId: string | null, input: EtudInput) {
  if (input.endMinute <= input.startMinute) throw new CenterError("Bitiş saati başlangıçtan sonra olmalı.");
  // Öğretmen rolündeki personel yalnızca kendi etüdünü planlar.
  const teacherId = ctx.member.role === "TEACHER" ? ctx.member.id : input.teacherId;
  if (teacherId && !(await db.centerMember.findFirst({ where: { id: teacherId, centerId: ctx.center.id } }))) throw new CenterError("Öğretmen bulunamadı.");
  const students = (await db.centerStudent.findMany({ where: { centerId: ctx.center.id, id: { in: input.studentIds } }, select: { id: true } })).map((s) => s.id);
  if (!students.length) throw new CenterError("Etüde en az bir öğrenci ekleyin.");
  const data = { ...input, teacherId, studentIds: students };
  await assertNoConflict(ctx, data, etudId ?? undefined);

  const fields = {
    teacherId,
    date: dateStringToDbDate(input.date),
    startMinute: input.startMinute,
    endMinute: input.endMinute,
    subject: input.subject,
    topic: input.topic,
    room: input.room,
    notes: input.notes,
  };
  if (etudId) {
    const etud = await getEtudOrThrow(ctx, etudId);
    await db.$transaction([
      db.centerEtud.update({ where: { id: etud.id }, data: fields }),
      db.centerEtudStudent.deleteMany({ where: { etudId: etud.id, studentId: { notIn: students } } }),
      db.centerEtudStudent.createMany({ data: students.map((studentId) => ({ etudId: etud.id, studentId })), skipDuplicates: true }),
    ]);
    return etud.id;
  }
  const etud = await db.centerEtud.create({ data: { ...fields, centerId: ctx.center.id, students: { create: students.map((studentId) => ({ studentId })) } } });
  return etud.id;
}

export async function getEtudOrThrow(ctx: CenterContext, etudId: string) {
  const etud = await db.centerEtud.findFirst({ where: { id: etudId, centerId: ctx.center.id } });
  if (!etud) throw new CenterError("Etüt bulunamadı.");
  if (ctx.member.role === "TEACHER" && etud.teacherId && etud.teacherId !== ctx.member.id) throw new CenterError("Bu etüt başka bir öğretmene ait.");
  return etud;
}

/** Etüt yapıldı: katılım işlenir, gelmeyen öğrencinin velisine (isteğe bağlı) bildirim gider. */
export async function completeEtud(ctx: CenterContext, etudId: string, attendance: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" }[], notes: string | null, notify: boolean) {
  const etud = await getEtudOrThrow(ctx, etudId);
  const enrolled = await db.centerEtudStudent.findMany({ where: { etudId }, include: { student: { select: { id: true, firstName: true, lastName: true } } } });
  const previous = new Map(enrolled.map((e) => [e.studentId, e.attendance]));
  await db.$transaction([
    db.centerEtud.update({ where: { id: etudId }, data: { status: "DONE", notes } }),
    ...attendance
      .filter((a) => previous.has(a.studentId))
      .map((a) => db.centerEtudStudent.update({ where: { etudId_studentId: { etudId, studentId: a.studentId } }, data: { attendance: a.status } })),
  ]);
  if (!notify || !ctx.center.notifyAbsence) return 0;
  let notified = 0;
  const [y, m, d] = etud.date.toISOString().slice(0, 10).split("-");
  const when = `${d}.${m}.${y} ${minutesToTime(etud.startMinute)}`;
  for (const a of attendance) {
    if (a.status !== "ABSENT" || previous.get(a.studentId) === "ABSENT") continue;
    const student = enrolled.find((e) => e.studentId === a.studentId)?.student;
    if (!student) continue;
    const name = `${student.firstName} ${student.lastName}`;
    await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: student.id,
      kind: "etud_absence",
      whatsappTitle: "Etüt devamsızlığı",
      template: { name: WA_TEMPLATES.absence, params: [name, when, `${etud.subject} etüt`, centerContact(ctx.center)] },
      whatsapp: `Sayın veli, öğrenciniz ${name} ${when} saatindeki ${etud.subject} etüdüne katılmamıştır.`,
      notification: { title: `${student.firstName} etüde katılmadı`, body: `${when} · ${etud.subject}` },
    });
    notified++;
  }
  return notified;
}

export async function setEtudStatus(ctx: CenterContext, etudId: string, status: "PLANNED" | "CANCELLED") {
  await getEtudOrThrow(ctx, etudId);
  await db.centerEtud.update({ where: { id: etudId }, data: { status } });
}

export async function deleteEtud(ctx: CenterContext, etudId: string) {
  await getEtudOrThrow(ctx, etudId);
  await db.centerEtud.delete({ where: { id: etudId } });
}

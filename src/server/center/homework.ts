import { dateStringToDbDate, dbDateToString } from "@/lib/dates";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Ödev takibi: sınıfa ya da seçilen öğrencilere ödev, teslimde öğrenci bazında kontrol, veliye bildirim.

export type HomeworkStatusName = "PENDING" | "DONE" | "PARTIAL" | "MISSING";

export type HomeworkInput = {
  groupId: string | null;
  studentIds: string[];
  subject: string;
  title: string;
  description: string | null;
  assignedOn: string;
  dueDate: string;
  notifyWhatsapp: boolean;
};

const shortDate = (date: string) => date.split("-").reverse().join(".");

export async function createHomework(ctx: CenterContext, input: HomeworkInput) {
  if (input.dueDate < input.assignedOn) throw new CenterError("Teslim tarihi veriliş tarihinden önce olamaz.", { dueDate: "Tarihi kontrol edin." });
  if (input.groupId && !(await db.centerGroup.findFirst({ where: { id: input.groupId, centerId: ctx.center.id } }))) throw new CenterError("Sınıf bulunamadı.");
  const students = await db.centerStudent.findMany({
    where: {
      centerId: ctx.center.id,
      status: "ACTIVE",
      OR: [...(input.groupId ? [{ groups: { some: { groupId: input.groupId } } }] : []), ...(input.studentIds.length ? [{ id: { in: input.studentIds } }] : [])],
    },
    select: { id: true, firstName: true },
  });
  if (!input.groupId && !input.studentIds.length) throw new CenterError("Sınıf ya da öğrenci seçin.", { groupId: "Seçin." });
  if (!students.length) throw new CenterError("Seçilen sınıfta aktif öğrenci yok.");
  const homework = await db.centerHomework.create({
    data: {
      centerId: ctx.center.id,
      groupId: input.groupId,
      teacherId: ctx.member.id,
      subject: input.subject,
      title: input.title,
      description: input.description,
      assignedOn: dateStringToDbDate(input.assignedOn),
      dueDate: dateStringToDbDate(input.dueDate),
      students: { create: students.map((s) => ({ studentId: s.id })) },
    },
  });
  for (const s of students) {
    await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: s.id,
      kind: "homework",
      whatsappTitle: "Yeni ödev",
      whatsapp: input.notifyWhatsapp ? `${s.firstName} için yeni ödev: ${input.subject} · ${input.title}${input.description ? ` (${input.description})` : ""}. Teslim: ${shortDate(input.dueDate)}` : null,
      notification: { title: `Yeni ödev: ${input.subject}`, body: `${input.title} · teslim ${shortDate(input.dueDate)}` },
    });
  }
  return { homework, count: students.length };
}

export async function getHomeworkOrThrow(ctx: CenterContext, homeworkId: string) {
  const homework = await db.centerHomework.findFirst({ where: { id: homeworkId, centerId: ctx.center.id } });
  if (!homework) throw new CenterError("Ödev bulunamadı.");
  if (ctx.member.role === "TEACHER" && homework.teacherId && homework.teacherId !== ctx.member.id) throw new CenterError("Bu ödevi başka bir öğretmen verdi.");
  return homework;
}

/** Teslim kontrolü; ilk kez “yapmadı” işaretlenen öğrencinin velisine (isteğe bağlı) bildirim gider. */
export async function checkHomework(ctx: CenterContext, homeworkId: string, records: { studentId: string; status: HomeworkStatusName; note: string | null }[], notifyMissing: boolean) {
  const homework = await getHomeworkOrThrow(ctx, homeworkId);
  const assigned = await db.centerHomeworkStudent.findMany({ where: { homeworkId }, include: { student: { select: { id: true, firstName: true, lastName: true } } } });
  const byId = new Map(assigned.map((a) => [a.studentId, a]));
  const valid = records.filter((r) => byId.has(r.studentId));
  await db.$transaction([
    ...valid.map((r) => db.centerHomeworkStudent.update({ where: { homeworkId_studentId: { homeworkId, studentId: r.studentId } }, data: { status: r.status, note: r.note } })),
    db.centerHomework.update({ where: { id: homeworkId }, data: { checkedAt: new Date() } }),
  ]);
  let notified = 0;
  if (notifyMissing) {
    for (const r of valid) {
      const row = byId.get(r.studentId)!;
      if (r.status !== "MISSING" || row.notifiedAt) continue;
      const name = `${row.student.firstName} ${row.student.lastName}`;
      await messageGuardians({
        centerId: ctx.center.id,
        centerName: ctx.center.name,
        studentId: row.studentId,
        kind: "homework_missing",
        whatsappTitle: "Yapılmayan ödev",
        whatsapp: `Sayın veli, öğrenciniz ${name} ${shortDate(dbDateToString(homework.dueDate))} teslimli “${homework.title}” (${homework.subject}) ödevini yapmamıştır.`,
        notification: { title: `${row.student.firstName} ödevini yapmadı`, body: `${homework.subject} · ${homework.title}` },
      });
      await db.centerHomeworkStudent.update({ where: { homeworkId_studentId: { homeworkId, studentId: r.studentId } }, data: { notifiedAt: new Date() } });
      notified++;
    }
  }
  return { saved: valid.length, notified };
}

export async function deleteHomework(ctx: CenterContext, homeworkId: string) {
  await getHomeworkOrThrow(ctx, homeworkId);
  await db.centerHomework.delete({ where: { id: homeworkId } });
}

/** Öğrencinin ödev özeti (kontrol edilenler arasında yapma oranı). */
export function homeworkRate(rows: { status: HomeworkStatusName }[]) {
  const checked = rows.filter((r) => r.status !== "PENDING");
  const done = checked.filter((r) => r.status === "DONE").length + checked.filter((r) => r.status === "PARTIAL").length * 0.5;
  return { checked: checked.length, missing: checked.filter((r) => r.status === "MISSING").length, rate: checked.length ? done / checked.length : null };
}

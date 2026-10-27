import { dateStringToDbDate, dbDateToString } from "@/lib/dates";
import { buildCenterReport, buildStudentRows, type ReportInput } from "@/lib/center/reports";
import { db } from "../db";
import { overdueByStudent } from "./finance";

// Kurum raporları için veri: dönemdeki yoklama, ödev kontrolü ve deneme sonuçları, bugünkü geciken ödemeler.

async function reportInput(centerId: string, from: string, to: string, groupId?: string): Promise<ReportInput> {
  const range = { gte: dateStringToDbDate(from), lte: dateStringToDbDate(to) };
  const students = await db.centerStudent.findMany({
    where: { centerId, status: "ACTIVE", ...(groupId ? { groups: { some: { groupId } } } : {}) },
    select: { id: true, firstName: true, lastName: true, studentNumber: true, groups: { select: { groupId: true } } },
  });
  const ids = students.map((s) => s.id);
  const [groups, attendance, homework, exams, overdue] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId, isActive: true, ...(groupId ? { id: groupId } : {}) }, select: { id: true, name: true, gradeName: true }, orderBy: { name: "asc" } }),
    db.centerAttendance.findMany({ where: { studentId: { in: ids }, session: { centerId, date: range, ...(groupId ? { groupId } : {}) } }, select: { studentId: true, status: true } }),
    db.centerHomeworkStudent.findMany({ where: { studentId: { in: ids }, homework: { centerId, dueDate: range } }, select: { studentId: true, status: true } }),
    db.centerExamResult.findMany({ where: { studentId: { in: ids }, exam: { centerId, date: range } }, select: { studentId: true, net: true, exam: { select: { id: true, name: true, date: true } } } }),
    overdueByStudent(centerId),
  ]);
  return {
    students: students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, studentNumber: s.studentNumber, groupIds: s.groups.map((g) => g.groupId) })),
    groups,
    attendance,
    homework,
    exams: exams.map((e) => ({ examId: e.exam.id, examName: e.exam.name, date: dbDateToString(e.exam.date), studentId: e.studentId, net: e.net })),
    overdue: overdue.map((o) => ({ studentId: o.studentId, amount: o.amount })),
  };
}

/** Kurum geneli ve sınıf bazında özet. */
export async function centerReport(centerId: string, from: string, to: string) {
  return buildCenterReport(await reportInput(centerId, from, to));
}

/** Bir sınıfın özeti ve öğrenci bazında satırlar. */
export async function groupReport(centerId: string, groupId: string, from: string, to: string) {
  const input = await reportInput(centerId, from, to, groupId);
  const { total, groups } = buildCenterReport(input);
  return { group: groups[0] ?? null, total, students: buildStudentRows(input) };
}

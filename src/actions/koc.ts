"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import type { ExamKindName } from "@/lib/center/exams";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { date, email, guard, int, opt, phone, requiredText, str, time } from "@/server/center/form";
import { assignResource } from "@/server/center/resources";
import { createStudent } from "@/server/center/students";
import { db } from "@/server/db";
import { addQuestionLog, addStudentExam, deleteQuestionLog, deleteStudentExam, KOC_EXAM_KINDS, kocStudentOrThrow } from "@/server/koc";

async function coachAuth(permission: Parameters<typeof centerAction>[0]) {
  const auth = await centerAction(permission);
  if (auth.ok && auth.ctx.center.kind !== "COACH") return { ok: false as const, state: failure("Bu işlem yalnızca Pi Koç hesabında kullanılır.") };
  return auth;
}

function meeting(formData: FormData) {
  const weekday = int(formData, "coachWeekday", 0, 0, 7);
  const minute = str(formData, "coachTime") ? time(formData, "coachTime", "Görüşme saati") : null;
  return { coachWeekday: weekday || null, coachMinute: weekday ? minute : null };
}

function studentFields(formData: FormData) {
  return {
    firstName: requiredText(formData, "firstName", "Ad", 2, 50),
    lastName: requiredText(formData, "lastName", "Soyad", 2, 50),
    gradeName: opt(formData, "gradeName", 40),
    targetExam: opt(formData, "targetExam", 40),
    schoolName: opt(formData, "schoolName", 120),
    phone: phone(formData, "phone", "Öğrenci telefonu"),
    notes: opt(formData, "notes", 2000),
  };
}

/** Öğrenci ekleme: koç kendini öğrencinin koçu olarak atar; veli bilgisi isteğe bağlıdır. */
export async function kocCreateStudentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  let id = "";
  const result = await guard(async () => {
    const fields = studentFields(formData);
    const guardianName = str(formData, "guardianName", 80);
    const guardianPhone = phone(formData, "guardianPhone", "Veli telefonu");
    const guardianEmail = email(formData, "guardianEmail");
    if ((guardianPhone || guardianEmail) && guardianName.length < 3) throw new CenterError("Velinin adını ve soyadını yazın.", { guardianName: "Ad soyad gerekli." });
    const student = await createStudent(
      auth.ctx,
      { ...fields, studentNumber: null, gender: "UNSPECIFIED", birthDate: null, identityNumber: null, email: null, address: null },
      guardianName ? [{ fullName: guardianName, relation: "Veli", phone: guardianPhone, email: guardianEmail, isPrimary: true, notifyWhatsapp: false, notifyEmail: Boolean(guardianEmail) }] : [],
      [],
    );
    await db.centerStudent.update({ where: { id: student.id }, data: { coachId: auth.ctx.member.id, ...meeting(formData) } });
    id = student.id;
    await centerAudit(auth.ctx, "student.create", "CenterStudent", id);
    return success();
  });
  if (!result.ok) return result;
  redirect(`/koc/ogrenciler/${id}?durum=eklendi`);
}

export async function kocUpdateStudentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const student = await kocStudentOrThrow(auth.ctx, str(formData, "studentId"));
    await db.centerStudent.update({ where: { id: student.id }, data: { ...studentFields(formData), ...meeting(formData), coachId: auth.ctx.member.id } });
    refresh();
    return success("Öğrenci bilgileri kaydedildi.");
  });
}

export async function kocSetStudentActiveAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const student = await kocStudentOrThrow(auth.ctx, str(formData, "studentId"));
    const active = str(formData, "active") === "1";
    if (active && student.status !== "ACTIVE") {
      const count = await db.centerStudent.count({ where: { centerId: auth.ctx.center.id, status: "ACTIVE" } });
      if (count >= auth.ctx.center.studentLimit) throw new CenterError(`Planınızın öğrenci sınırı ${auth.ctx.center.studentLimit}. Önce bir öğrenciyi arşive alın.`);
    }
    await db.centerStudent.update({ where: { id: student.id }, data: { status: active ? "ACTIVE" : "PASSIVE" } });
    refresh();
    return success(active ? "Öğrenci yeniden aktif." : "Öğrenci arşive alındı; kayıtları duruyor.");
  });
}

export async function kocAddQuestionLogAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await addQuestionLog(auth.ctx, str(formData, "studentId"), {
      date: date(formData, "date", "Gün"),
      subject: requiredText(formData, "subject", "Ders", 2, 60),
      solved: int(formData, "solved", 0, 0, 5000),
      correct: int(formData, "correct", 0, 0, 5000),
      wrong: int(formData, "wrong", 0, 0, 5000),
    });
    refresh();
    return success("Soru kaydı eklendi.");
  });
}

export async function kocDeleteQuestionLogAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteQuestionLog(auth.ctx, str(formData, "logId"));
    refresh();
    return success();
  });
}

export async function kocAddExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const kind = str(formData, "kind") as ExamKindName;
    if (!KOC_EXAM_KINDS.includes(kind)) throw new CenterError("Sınav türünü seçin.", { kind: "Seçin." });
    const sections = Array.from({ length: 10 }, (_, i) => ({ correct: int(formData, `c${i}`, 0, 0, 200), wrong: int(formData, `w${i}`, 0, 0, 200) }));
    await addStudentExam(auth.ctx, str(formData, "studentId"), { kind, name: requiredText(formData, "name", "Deneme adı", 2, 120), date: date(formData, "date", "Tarih"), sections });
    refresh();
    return success("Deneme sonucu kaydedildi.");
  });
}

export async function kocDeleteExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("exams.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteStudentExam(auth.ctx, str(formData, "examId"));
    refresh();
    return success();
  });
}

export async function kocAssignResourceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const studentId = str(formData, "studentId");
    await kocStudentOrThrow(auth.ctx, studentId);
    const result = await assignResource(auth.ctx, str(formData, "resourceId"), { groupId: null, studentIds: [studentId] });
    refresh();
    return success(result.added ? "Kaynak öğrenciye eklendi." : "Bu kaynak zaten ekli.");
  });
}

/** Koç hesabı: panelde görünen ad ve iletişim bilgileri. */
export async function kocSaveSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("settings.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await db.center.update({
      where: { id: auth.ctx.center.id },
      data: { name: requiredText(formData, "name", "Ad", 3, 120), phone: phone(formData, "phone"), email: email(formData, "email") },
    });
    await centerAudit(auth.ctx, "settings.update", "Center", auth.ctx.center.id);
    refresh();
    return success("Bilgileriniz kaydedildi.");
  });
}

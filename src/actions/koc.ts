"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { EXAM_PRESETS, type ExamKindName } from "@/lib/center/exams";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { date, email, guard, int, money, opt, phone, requiredText, str, time } from "@/server/center/form";
import { assignResource } from "@/server/center/resources";
import { createStudent } from "@/server/center/students";
import { db } from "@/server/db";
import { actionUser } from "@/server/auth/current-user";
import { draftReportNote, saveReport, sendReport } from "@/server/koc-report";
import { isDateString } from "@/lib/dates";
import { addPortalStudySession, addStudySession, deleteCoachPayment, deleteStudySession, recordCoachPayment } from "@/server/koc-extra";
import { addTopicToPlan, applyTemplate, deleteTemplate, saveWeekAsTemplate } from "@/server/koc-plan";
import { addPortalQuestionLog, addPortalStudentExam, addQuestionLog, addStudentExam, deletePortalStudentExam, deleteGoal, deletePortalQuestionLog, deleteQuestionLog, deleteStudentExam, KOC_EXAM_KINDS, kocStudentOrThrow, saveGoal, savePortalGoal } from "@/server/koc";

function logInput(formData: FormData) {
  return {
    date: date(formData, "date", "Gün"),
    subject: requiredText(formData, "subject", "Ders", 2, 60),
    solved: int(formData, "solved", 0, 0, 5000),
    correct: int(formData, "correct", 0, 0, 5000),
    wrong: int(formData, "wrong", 0, 0, 5000),
  };
}

/** Öğrenci kendi hesabından çözdüğü soruyu girer (Pi Koç öğrencisi). */
export async function portalAddQuestionLogAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await addPortalQuestionLog(user.id, str(formData, "studentId"), logInput(formData));
    refresh();
    return success("Kaydedildi. Koçun görecek.");
  });
}

export async function portalDeleteQuestionLogAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await deletePortalQuestionLog(user.id, str(formData, "logId"));
    refresh();
    return success();
  });
}

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
    // Koçun aylık ücreti (tahsilat takibi); boş bırakılabilir
    monthlyFee: str(formData, "monthlyFee") ? money(formData, "monthlyFee", "Aylık ücret", { allowZero: true }) || null : null,
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
    await db.centerStudent.update({ where: { id: student.id }, data: { coachId: auth.ctx.member.id, monthlyFee: fields.monthlyFee, ...meeting(formData) } });
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

// ---------------------------------------------------------------------------
// Haftalık veli raporu
// ---------------------------------------------------------------------------

export async function kocSaveReportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await saveReport(auth.ctx, str(formData, "studentId"), date(formData, "weekStart", "Hafta"), opt(formData, "note", 3000));
    refresh();
    return success("Değerlendirme kaydedildi.");
  });
}

/** Değerlendirme taslağı (yapay zekâ ya da kurallı özet); kaydetmez, metni forma döndürür. */
export async function kocDraftReportAction(studentId: string, weekStart: string): Promise<{ ok: true; text: string; source: "ai" | "rule" } | { ok: false; error: string }> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return { ok: false, error: auth.state.error ?? "Yetkiniz yok." };
  if (typeof studentId !== "string" || typeof weekStart !== "string" || !isDateString(weekStart)) return { ok: false, error: "Geçersiz istek." };
  try {
    return { ok: true, ...(await draftReportNote(auth.ctx, studentId, weekStart)) };
  } catch (error) {
    if (error instanceof CenterError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function kocSendReportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const studentId = str(formData, "studentId");
    const { counts } = await sendReport(auth.ctx, studentId, date(formData, "weekStart", "Hafta"));
    await centerAudit(auth.ctx, "report.send", "CenterStudent", studentId);
    refresh();
    const sent = counts.email + counts.whatsapp;
    return success(sent ? `Rapor velilere gönderildi (${[counts.email ? `${counts.email} e-posta` : null, counts.whatsapp ? `${counts.whatsapp} WhatsApp` : null].filter(Boolean).join(", ")}).` : "Veliye ulaşacak kanal bulunamadı; bağlantıyı kopyalayıp gönderin.");
  });
}

// ---------------------------------------------------------------------------
// Hedef takibi
// ---------------------------------------------------------------------------

function goalInput(formData: FormData) {
  const kind = str(formData, "kind") as ExamKindName;
  if (!KOC_EXAM_KINDS.includes(kind)) throw new CenterError("Sınav türünü seçin.", { kind: "Seçin." });
  const sectionNets: Record<string, number> = {};
  EXAM_PRESETS[kind].sections.forEach((s, i) => {
    const raw = str(formData, `t${i}`).replace(",", ".");
    if (raw) sectionNets[s.name] = Number(raw);
  });
  return { kind, label: opt(formData, "label", 120), sectionNets };
}

export async function kocSaveGoalAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await saveGoal(auth.ctx, str(formData, "studentId"), goalInput(formData));
    refresh();
    return success("Hedef kaydedildi.");
  });
}

export async function kocDeleteGoalAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteGoal(auth.ctx, str(formData, "studentId"), str(formData, "kind") as ExamKindName);
    refresh();
    return success("Hedef silindi.");
  });
}

/** Öğrenci kendi hedefini yazar. */
export async function portalSaveGoalAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await savePortalGoal(user.id, str(formData, "studentId"), goalInput(formData));
    refresh();
    return success("Hedefin kaydedildi.");
  });
}

// ---------------------------------------------------------------------------
// Konu haritası ve program şablonları
// ---------------------------------------------------------------------------

export async function kocAddTopicToPlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const target = int(formData, "targetQuestions", 30, 0, 2000);
    await addTopicToPlan(auth.ctx, str(formData, "studentId"), {
      subject: requiredText(formData, "subject", "Ders", 2, 60),
      topic: requiredText(formData, "topic", "Konu", 2, 160),
      resourceId: opt(formData, "resourceId"),
      date: date(formData, "date", "Gün"),
      targetQuestions: target || null,
    });
    refresh();
    return success("Programa eklendi.");
  });
}

export async function kocApplyTemplateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const count = await applyTemplate(auth.ctx, str(formData, "studentId"), str(formData, "templateId"), date(formData, "weekStart", "Hafta"));
    refresh();
    return success(count ? `${count} görev haftaya eklendi.` : "Şablondaki görevler bu haftada zaten var.");
  });
}

export async function kocSaveTemplateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await saveWeekAsTemplate(auth.ctx, str(formData, "studentId"), date(formData, "weekStart", "Hafta"), requiredText(formData, "name", "Şablon adı", 2, 80));
    refresh();
    return success("Şablon kaydedildi; diğer öğrencilere de uygulayabilirsiniz.");
  });
}

export async function kocDeleteTemplateAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteTemplate(auth.ctx, str(formData, "templateId"));
    refresh();
    return success("Şablon silindi.");
  });
}

// ---------------------------------------------------------------------------
// Öğrencinin deneme girişi, çalışma süresi, koçun tahsilatı
// ---------------------------------------------------------------------------

function examInput(formData: FormData) {
  const kind = str(formData, "kind") as ExamKindName;
  if (!KOC_EXAM_KINDS.includes(kind)) throw new CenterError("Sınav türünü seçin.", { kind: "Seçin." });
  const sections = Array.from({ length: 10 }, (_, i) => ({ correct: int(formData, `c${i}`, 0, 0, 200), wrong: int(formData, `w${i}`, 0, 0, 200) }));
  return { kind, name: requiredText(formData, "name", "Deneme adı", 2, 120), date: date(formData, "date", "Tarih"), sections };
}

/** Öğrenci kendi deneme sonucunu girer. */
export async function portalAddExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await addPortalStudentExam(user.id, str(formData, "studentId"), examInput(formData));
    refresh();
    return success("Deneme sonucun kaydedildi. Koçun görecek.");
  });
}

export async function portalDeleteExamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await deletePortalStudentExam(user.id, str(formData, "examId"));
    refresh();
    return success();
  });
}

function studyInput(formData: FormData) {
  return { date: date(formData, "date", "Gün"), subject: opt(formData, "subject", 60), minutes: int(formData, "minutes", 0, 0, 100_000) };
}

export async function kocAddStudyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await addStudySession(auth.ctx, str(formData, "studentId"), studyInput(formData));
    refresh();
    return success("Çalışma süresi eklendi.");
  });
}

export async function portalAddStudyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await addPortalStudySession(user.id, str(formData, "studentId"), studyInput(formData));
    refresh();
    return success("Çalışma süren kaydedildi.");
  });
}

export async function kocDeleteStudyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteStudySession({ ctx: auth.ctx }, str(formData, "sessionId"));
    refresh();
    return success();
  });
}

export async function portalDeleteStudyAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış. Tekrar giriş yapın.");
  return guard(async () => {
    await deleteStudySession({ userId: user.id }, str(formData, "sessionId"));
    refresh();
    return success();
  });
}

export async function kocRecordPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const studentId = str(formData, "studentId");
    await recordCoachPayment(auth.ctx, studentId, { period: str(formData, "period", 7), amount: money(formData, "amount", "Tutar"), method: opt(formData, "method", 30), note: opt(formData, "note", 200) });
    await centerAudit(auth.ctx, "coach.payment", "CenterStudent", studentId);
    refresh();
    return success("Ödeme kaydedildi.");
  });
}

export async function kocDeletePaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await coachAuth("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteCoachPayment(auth.ctx, str(formData, "paymentId"));
    refresh();
    return success("Ödeme kaydı geri alındı.");
  });
}

import { addDaysToDateString, dateStringToDbDate, dbDateToString, isDateString, toLocalDateString } from "@/lib/dates";
import { editionAllows } from "@/lib/center/editions";
import { installmentState } from "@/lib/center/finance";
import { type CenterModuleKey, moduleEnabled } from "@/lib/center/modules";
import { studentCoachingHistory } from "../center/coaching";
import { marketplaceLink, studentExamReport } from "../center/exams";
import { portalChildDetail, portalChildren } from "../center/portal";
import { resourceSummary, weekStartOf } from "../center/resources";
import { studentHallDays } from "../center/study-hall";
import { db } from "../db";
import { appUrl } from "../email";
import { notFound } from "./http";
import { absoluteUpload } from "./serialize";

// Mobil uygulama için veli portalı (kurum paneli) verileri. Tutarlar kuruş, tarihler ISO / "YYYY-MM-DD".

export async function childrenJson(userId: string) {
  const links = await portalChildren(userId);
  return {
    items: links.map((link) => ({
      id: link.id,
      relation: link.relation,
      // Kurumun açtığı öğrenci hesabı (öğrencinin kendisi; uygulamada "Bilgilerim")
      isStudentAccount: link.isStudentAccount,
      student: {
        firstName: link.student.firstName,
        lastName: link.student.lastName,
        gradeName: link.student.gradeName,
        groups: link.student.groups.map((g) => g.group.name),
      },
      center: { name: link.student.center.name, phone: link.student.center.phone, logoUrl: absoluteUpload(link.student.center.logoKey) },
    })),
  };
}

const COMMON_SUBJECTS = ["Matematik", "Türkçe", "Fen Bilimleri", "Fizik", "Kimya", "Biyoloji", "Geometri", "İngilizce", "Sosyal Bilgiler", "Tarih", "Coğrafya", "Diğer"];

export async function childDetailJson(userId: string, guardianId: string) {
  const data = await portalChildDetail(userId, guardianId);
  if (!data) throw notFound("Öğrenci bulunamadı.");
  const { guardian, student, attendance, etuds, results, installments, payments, announcements, notes, weakTopics, balance, today, trend, homeworks, questions } = data;
  const hallDays = await studentHallDays(student.id);
  const on = (key: CenterModuleKey) => moduleEnabled(student.center, key);
  return {
    id: guardianId,
    isStudentAccount: guardian.isStudentAccount,
    // Kurumun paketinde olmayan ya da kapattığı bölümler portalda gösterilmez (webdeki sekmelerle aynı)
    modules: {
      exams: on("denemeler"),
      payments: on("muhasebe"),
      homework: on("odevler"),
      study: on("kaynaklar"),
      questions: on("sorular"),
      etuds: on("etutler"),
      hall: on("calisma-salonu"),
      schedule: editionAllows(student.center.edition, "program"),
    },
    student: { firstName: student.firstName, lastName: student.lastName, gradeName: student.gradeName, studentNumber: student.studentNumber },
    center: { name: student.center.name, phone: student.center.phone, email: student.center.email, address: student.center.address, logoUrl: absoluteUpload(student.center.logoKey) },
    balance,
    attendance: attendance.map((a) => ({
      date: dbDateToString(a.session.date),
      startMinute: a.session.startMinute,
      subject: a.session.subject,
      group: a.session.group.name,
      status: a.status,
    })),
    etuds: etuds.map(({ etud, attendance: status }) => ({
      id: etud.id,
      date: dbDateToString(etud.date),
      startMinute: etud.startMinute,
      endMinute: etud.endMinute,
      subject: etud.subject,
      topic: etud.topic,
      teacher: etud.teacher ? `${etud.teacher.user.firstName} ${etud.teacher.user.lastName}` : null,
      status: etud.status,
      attendance: status,
    })),
    exams: results.map((r) => ({
      examId: r.examId,
      name: r.exam.name,
      kind: r.exam.kind,
      date: dbDateToString(r.exam.date),
      net: r.net,
      correct: r.correct,
      wrong: r.wrong,
      blank: r.blank,
      rank: r.rank,
      participants: r.exam._count.results,
      sections: r.exam.sections.map((s) => {
        const own = r.sections.find((x) => x.sectionId === s.id);
        return { name: s.name, questionCount: s.questionCount, net: own?.net ?? null };
      }),
    })),
    trend: trend.map((t) => ({ name: t.name, date: dbDateToString(t.date), net: t.net, average: t.average })),
    weakTopics: weakTopics.map((t) => ({ topic: t.topic, section: t.sectionName, rate: t.rate, questions: t.questions, teachersUrl: student.center.showTeacherSuggestions ? appUrl(marketplaceLink(t.kind, t.subjectSlug)) : null })),
    installments: installments.map((i) => ({
      title: i.plan.title,
      order: i.order,
      dueDate: dbDateToString(i.dueDate),
      amount: i.amount,
      paidAmount: i.paidAmount,
      state: installmentState({ dueDate: dbDateToString(i.dueDate), amount: i.amount, paidAmount: i.paidAmount }, today),
    })),
    payments: payments.map((p) => ({ receiptNo: p.receiptNo, amount: p.amount, method: p.method, paidAt: p.paidAt.toISOString() })),
    announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, group: a.group?.name ?? null, createdAt: a.createdAt.toISOString() })),
    notes: notes.map((n) => ({ kind: n.kind, text: n.text, author: n.author ? `${n.author.user.firstName} ${n.author.user.lastName}` : null, createdAt: n.createdAt.toISOString() })),
    homeworks: homeworks.map((h) => ({ id: h.homeworkId, subject: h.homework.subject, title: h.homework.title, description: h.homework.description, assignedOn: dbDateToString(h.homework.assignedOn), dueDate: dbDateToString(h.homework.dueDate), status: h.status, note: h.note })),
    // mine: soruyu bu hesap sordu (cevaplanmamışsa DELETE /kurum/{id}/sorular/{soruId} ile geri çekilebilir)
    questions: questions.map((q) => ({ id: q.id, subject: q.subject, note: q.note, imageUrl: absoluteUpload(q.imageKey), status: q.status, answerText: q.answerText, answerImageUrl: absoluteUpload(q.answerImageKey), answerVideoUrl: absoluteUpload(q.answerVideoKey), answeredBy: q.answeredBy ? `${q.answeredBy.user.firstName} ${q.answeredBy.user.lastName}` : null, answeredAt: q.answeredAt?.toISOString() ?? null, createdAt: q.createdAt.toISOString(), mine: q.askedByUserId === userId })),
    // Soru sorarken seçilebilecek dersler (programdaki dersler ve sık kullanılanlar)
    questionSubjects: [...new Set([...student.groups.flatMap((g) => g.group.slots.map((s) => s.subject)), ...COMMON_SUBJECTS])],
    schedule: student.groups
      .flatMap((g) => g.group.slots.map((s) => ({ weekday: s.weekday, startMinute: s.startMinute, endMinute: s.endMinute, subject: s.subject, group: g.group.name, room: s.room, teacher: s.teacher ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : null })))
      .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
    // Çalışma salonu: marks periyot başına G (geldi), Y (gelmedi), - (işaretlenmedi)
    hallDays: hallDays.map((d) => ({ date: d.date, hall: d.hall, periods: d.periods, marks: d.marks, present: d.present, marked: d.marked })),
  };
}

/** Portal bağlantısının öğrencisi (yalnızca bağlantının sahibi). */
async function portalStudent(userId: string, guardianId: string) {
  const link = await db.centerGuardian.findFirst({
    where: { id: guardianId, userId, student: { center: { status: { not: "SUSPENDED" } } } },
    select: { student: { select: { id: true, centerId: true, coachWeekday: true, coachMinute: true, coach: { select: { user: { select: { firstName: true, lastName: true } } } } } } },
  });
  if (!link) throw notFound("Öğrenci bulunamadı.");
  return link.student;
}

/** Haftalık çalışma programı (?hafta=YYYY-AA-GG o haftanın herhangi bir günü), kaynak ilerlemesi ve koç görüşmeleri. */
export async function studyJson(userId: string, guardianId: string, week: string | null) {
  const student = await portalStudent(userId, guardianId);
  const today = toLocalDateString(new Date());
  const weekStart = weekStartOf(week && isDateString(week) ? week : today);
  const [items, assigned, coaching] = await Promise.all([
    db.centerStudyPlanItem.findMany({
      where: { centerId: student.centerId, studentId: student.id, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(addDaysToDateString(weekStart, 7)) } },
      include: { resource: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    db.centerStudentResource.findMany({ where: { studentId: student.id }, include: { resource: true, progress: true }, orderBy: { assignedAt: "asc" } }),
    studentCoachingHistory(student.centerId, student.id, { parentOnly: true }),
  ]);
  return {
    weekStart,
    weekEnd: addDaysToDateString(weekStart, 6),
    today,
    items: items.map((i) => ({ id: i.id, date: dbDateToString(i.date), subject: i.subject, topic: i.topic, resource: i.resource?.name ?? null, targetQuestions: i.targetQuestions, note: i.note, done: Boolean(i.doneAt) })),
    // id: öğrenci-kaynak bağlantısı (ilerleme PUT /kurum/{id}/kaynaklar/{id} ile girilir)
    resources: assigned.map((a) => {
      const summary = resourceSummary(a.resource.topics, a.progress);
      return {
        id: a.id,
        name: a.resource.name,
        subject: a.resource.subject,
        publisher: a.resource.publisher,
        topicCount: a.resource.topics.length,
        doneCount: summary.doneCount,
        completion: summary.completion,
        solved: summary.solved,
        accuracy: summary.accuracy,
        topics: summary.rows.map((r) => ({ topic: r.topic, solved: r.solved, correct: r.correct, wrong: r.wrong, done: r.done, accuracy: r.accuracy })),
      };
    }),
    coaching: {
      coach: student.coach ? `${student.coach.user.firstName} ${student.coach.user.lastName}` : null,
      weekday: student.coachWeekday,
      minute: student.coachMinute,
      sessions: coaching.sessions.map((s) => ({ id: s.id, date: s.dateString, coach: s.coachName, held: s.held, notes: s.notes, priorityTopics: s.priorityTopics, nextGoal: s.nextGoal })),
    },
  };
}

/** Portal kullanıcısı bu kaydın öğrencisine bağlı mı? (program maddesi ve kaynak ilerlemesi için) */
export async function assertPortalStudent(userId: string, guardianId: string, studentId: string) {
  const student = await portalStudent(userId, guardianId);
  if (student.id !== studentId) throw notFound("Kayıt bulunamadı.");
}

export async function reportCardJson(userId: string, guardianId: string, examId: string) {
  const data = await portalChildDetail(userId, guardianId);
  if (!data || !data.results.some((r) => r.examId === examId)) throw notFound("Deneme sonucu bulunamadı.");
  const report = await studentExamReport(data.student.centerId, examId, data.student.id, { publishedOnly: true });
  if (!report?.result) throw notFound("Deneme sonucu bulunamadı.");
  const { analysis, result, sections, weakTopics, trend } = report;
  return {
    exam: { id: analysis.exam.id, name: analysis.exam.name, kind: analysis.exam.kind, date: dbDateToString(analysis.exam.date), publisher: analysis.exam.publisher },
    result: { net: result.net, correct: result.correct, wrong: result.wrong, blank: result.blank, score: result.score, rank: result.rank, participants: analysis.participants },
    average: analysis.average,
    sections: sections.map((s) => ({
      name: s.section.name,
      questionCount: s.section.questionCount,
      correct: s.own?.correct ?? null,
      wrong: s.own?.wrong ?? null,
      blank: s.own?.blank ?? null,
      net: s.own?.net ?? null,
      averageNet: s.average.net,
      topics: s.topics.map((t) => ({ topic: t.topic, questions: t.questions, correct: t.correct, rate: t.rate })),
    })),
    weakTopics: weakTopics.map((t) => ({ topic: t.topic, section: t.sectionName, rate: t.rate, teachersUrl: data.student.center.showTeacherSuggestions ? appUrl(marketplaceLink(analysis.exam.kind, t.subjectSlug)) : null })),
    trend: trend.map((t) => ({ name: t.name, date: dbDateToString(t.date), net: t.net, average: t.average })),
  };
}

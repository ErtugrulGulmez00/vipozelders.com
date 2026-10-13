import { dbDateToString } from "@/lib/dates";
import { installmentState } from "@/lib/center/finance";
import { marketplaceLink, studentExamReport } from "../center/exams";
import { portalChildDetail, portalChildren } from "../center/portal";
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

export async function childDetailJson(userId: string, guardianId: string) {
  const data = await portalChildDetail(userId, guardianId);
  if (!data) throw notFound("Öğrenci bulunamadı.");
  const { student, attendance, etuds, results, installments, payments, announcements, notes, weakTopics, balance, today, trend, homeworks } = data;
  return {
    id: guardianId,
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
    schedule: student.groups
      .flatMap((g) => g.group.slots.map((s) => ({ weekday: s.weekday, startMinute: s.startMinute, endMinute: s.endMinute, subject: s.subject, group: g.group.name, room: s.room, teacher: s.teacher ? `${s.teacher.user.firstName} ${s.teacher.user.lastName}` : null })))
      .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
  };
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

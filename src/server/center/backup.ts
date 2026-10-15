import { ATTENDANCE_STATUS, EXPENSE_CATEGORY_LABEL, HOMEWORK_STATUS, LEAD_STATUS, NOTE_KIND_LABEL, PAYMENT_METHOD_LABEL, STUDENT_STATUS } from "@/lib/center/labels";
import { EXAM_PRESETS } from "@/lib/center/exams";
import { dbDateToString, minutesToTime, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { GENDER_LABEL } from "@/lib/labels";
import { db } from "../db";
import { buildWorkbook, type SheetSpec } from "./spreadsheet";

// Kurumun tüm verileri tek Excel dosyasında (yedek / başka sisteme taşıma). T.C. kimlik numarası dahil edilmez.

const d = (date: Date | null | undefined) => (date ? dbDateToString(date).split("-").reverse().join(".") : null);
const dt = (date: Date | null | undefined) => (date ? toLocalDateString(date).split("-").reverse().join(".") : null);
const tl = (kurus: number) => kurus / 100;
const name = (p: { firstName: string; lastName: string } | null | undefined) => (p ? `${p.firstName} ${p.lastName}` : null);

export async function centerBackupWorkbook(centerId: string): Promise<Buffer> {
  const [students, groups, slots, attendance, etuds, exams, plans, payments, expenses, notes, homeworks, leads, announcements, resourceProgress, studyPlan, coaching, hallDays] = await Promise.all([
    db.centerStudent.findMany({ where: { centerId }, include: { guardians: { where: { isStudentAccount: false } }, groups: { include: { group: { select: { name: true } } } } }, orderBy: { studentNumber: "asc" } }),
    db.centerGroup.findMany({ where: { centerId }, include: { teacher: { include: { user: true } }, _count: { select: { students: true } } }, orderBy: { name: "asc" } }),
    db.centerScheduleSlot.findMany({ where: { centerId }, include: { group: { select: { name: true } }, teacher: { include: { user: true } } }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] }),
    db.centerAttendance.findMany({ where: { session: { centerId } }, include: { session: { include: { group: { select: { name: true } } } }, student: true }, orderBy: [{ session: { date: "asc" } }, { session: { startMinute: "asc" } }] }),
    db.centerEtudStudent.findMany({ where: { etud: { centerId } }, include: { etud: { include: { teacher: { include: { user: true } } } }, student: true }, orderBy: { etud: { date: "asc" } } }),
    db.centerExam.findMany({ where: { centerId }, include: { sections: { orderBy: { order: "asc" } }, results: { include: { student: true, sections: true } } }, orderBy: { date: "asc" } }),
    db.centerInstallment.findMany({ where: { centerId }, include: { plan: true, student: true }, orderBy: [{ dueDate: "asc" }] }),
    db.centerPayment.findMany({ where: { centerId }, include: { student: true }, orderBy: { receiptNo: "asc" } }),
    db.centerExpense.findMany({ where: { centerId }, include: { member: { include: { user: true } } }, orderBy: { date: "asc" } }),
    db.centerNote.findMany({ where: { centerId }, include: { student: true, author: { include: { user: true } } }, orderBy: { createdAt: "asc" } }),
    db.centerHomeworkStudent.findMany({ where: { homework: { centerId } }, include: { homework: { include: { group: { select: { name: true } } } }, student: true }, orderBy: { homework: { dueDate: "asc" } } }),
    db.centerLead.findMany({ where: { centerId }, orderBy: { createdAt: "asc" } }),
    db.centerAnnouncement.findMany({ where: { centerId }, include: { group: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.centerStudentResource.findMany({ where: { student: { centerId } }, include: { resource: true, student: true, progress: true }, orderBy: { assignedAt: "asc" } }),
    db.centerStudyPlanItem.findMany({ where: { centerId }, include: { student: true, resource: { select: { name: true } } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    db.centerCoachingSession.findMany({ where: { centerId }, include: { student: true, coach: { include: { user: true } } }, orderBy: { date: "asc" } }),
    db.centerHallDay.findMany({ where: { hall: { centerId } }, include: { student: true, hall: true }, orderBy: { date: "asc" } }),
  ]);

  const sheets: SheetSpec[] = [
    {
      name: "Öğrenciler",
      headers: ["Öğrenci No", "Ad", "Soyad", "Cinsiyet", "Doğum Tarihi", "Okul", "Sınıf", "Hedef", "Sınıflar", "Telefon", "E-posta", "Adres", "Durum", "Kayıt", "Ayrılış", "Notlar"],
      rows: students.map((s) => [s.studentNumber, s.firstName, s.lastName, GENDER_LABEL[s.gender], d(s.birthDate), s.schoolName, s.gradeName, s.targetExam, s.groups.map((g) => g.group.name).join(", "), s.phone, s.email, s.address, STUDENT_STATUS[s.status].label, dt(s.enrolledAt), dt(s.leftAt), s.notes]),
    },
    {
      name: "Veliler",
      headers: ["Öğrenci No", "Öğrenci", "Veli", "Yakınlık", "Telefon", "E-posta", "Birincil", "SMS", "E-posta bildirimi", "Portala bağlı"],
      rows: students.flatMap((s) => s.guardians.map((g) => [s.studentNumber, name(s), g.fullName, g.relation, g.phone, g.email, g.isPrimary ? "Evet" : "", g.notifySms ? "Açık" : "Kapalı", g.notifyEmail ? "Açık" : "Kapalı", g.userId ? "Evet" : ""])),
    },
    {
      name: "Sınıflar",
      headers: ["Sınıf", "Seviye", "Hedef", "Rehber öğretmen", "Derslik", "Kontenjan", "Öğrenci", "Durum"],
      rows: groups.map((g) => [g.name, g.gradeName, g.targetExam, name(g.teacher?.user), g.room, g.capacity, g._count.students, g.isActive ? "Etkin" : "Arşiv"]),
    },
    {
      name: "Ders programı",
      headers: ["Sınıf", "Gün", "Başlangıç", "Bitiş", "Ders", "Öğretmen", "Derslik"],
      rows: slots.map((s) => [s.group.name, WEEKDAY_NAMES[s.weekday - 1], minutesToTime(s.startMinute), minutesToTime(s.endMinute), s.subject, name(s.teacher?.user), s.room]),
    },
    {
      name: "Yoklama",
      headers: ["Tarih", "Saat", "Sınıf", "Ders", "İşlenen konu", "Öğrenci No", "Öğrenci", "Durum", "Not", "Veliye bildirildi"],
      rows: attendance.map((a) => [d(a.session.date), minutesToTime(a.session.startMinute), a.session.group.name, a.session.subject, a.session.topic, a.student.studentNumber, name(a.student), ATTENDANCE_STATUS[a.status].label, a.note, a.notifiedAt ? "Evet" : ""]),
    },
    {
      name: "Etütler",
      headers: ["Tarih", "Saat", "Ders", "Konu", "Öğretmen", "Öğrenci No", "Öğrenci", "Katılım"],
      rows: etuds.map((e) => [d(e.etud.date), minutesToTime(e.etud.startMinute), e.etud.subject, e.etud.topic, name(e.etud.teacher?.user), e.student.studentNumber, name(e.student), e.attendance ? ATTENDANCE_STATUS[e.attendance].label : null]),
    },
    {
      name: "Ödevler",
      headers: ["Veriliş", "Teslim", "Sınıf", "Ders", "Ödev", "Öğrenci No", "Öğrenci", "Durum", "Not"],
      rows: homeworks.map((h) => [d(h.homework.assignedOn), d(h.homework.dueDate), h.homework.group?.name, h.homework.subject, h.homework.title, h.student.studentNumber, name(h.student), HOMEWORK_STATUS[h.status].label, h.note]),
    },
    {
      name: "Kaynak ilerlemesi",
      headers: ["Öğrenci No", "Öğrenci", "Ders", "Kaynak", "Konu", "Çözülen", "Doğru", "Yanlış", "Bitti"],
      rows: resourceProgress.flatMap((a) =>
        a.resource.topics.map((topic) => {
          const p = a.progress.find((x) => x.topic === topic);
          return [a.student.studentNumber, name(a.student), a.resource.subject, a.resource.name, topic, p?.solved ?? 0, p?.correct ?? 0, p?.wrong ?? 0, p?.completedAt ? "Evet" : ""];
        }),
      ),
    },
    {
      name: "Çalışma programı",
      headers: ["Tarih", "Öğrenci No", "Öğrenci", "Ders", "Konu", "Kaynak", "Hedef soru", "Not", "Yapıldı"],
      rows: studyPlan.map((i) => [d(i.date), i.student.studentNumber, name(i.student), i.subject, i.topic, i.resource?.name, i.targetQuestions, i.note, i.doneAt ? "Evet" : ""]),
    },
    {
      name: "Koçluk görüşmeleri",
      headers: ["Tarih", "Öğrenci No", "Öğrenci", "Koç", "Yapıldı", "Not", "Öncelikli konular", "Hedef", "Veli görüyor"],
      rows: coaching.map((c) => [d(c.date), c.student.studentNumber, name(c.student), name(c.coach?.user), c.held ? "Evet" : "Hayır", c.notes, c.priorityTopics.join(", "), c.nextGoal, c.visibleToParent ? "Evet" : ""]),
    },
    {
      name: "Çalışma salonu",
      headers: ["Tarih", "Salon", "Öğrenci No", "Öğrenci", ...Array.from({ length: Math.max(0, ...hallDays.map((h) => h.hall.periods.length)) }, (_, i) => `${i + 1}. periyot`)],
      rows: hallDays.map((h) => [d(h.date), h.hall.name, h.student.studentNumber, name(h.student), ...h.hall.periods.map((_, i) => (h.marks[i] === "G" ? "Geldi" : h.marks[i] === "Y" ? "Gelmedi" : ""))]),
    },
    {
      name: "Deneme sonuçları",
      headers: ["Deneme", "Tür", "Tarih", "Öğrenci No", "Öğrenci", "Ders", "Soru", "D", "Y", "B", "Net", "Toplam net", "Sıra", "Puan"],
      rows: exams.flatMap((exam) =>
        exam.results.flatMap((r) =>
          exam.sections.map((section) => {
            const sr = r.sections.find((x) => x.sectionId === section.id);
            return [exam.name, EXAM_PRESETS[exam.kind].label, d(exam.date), r.student.studentNumber, name(r.student), section.name, section.questionCount, sr?.correct ?? null, sr?.wrong ?? null, sr?.blank ?? null, sr?.net ?? null, r.net, r.rank, r.score];
          }),
        ),
      ),
    },
    {
      name: "Taksitler",
      headers: ["Öğrenci No", "Öğrenci", "Plan", "Plan iptal", "Taksit", "Vade", "Tutar (TL)", "Ödenen (TL)", "Kalan (TL)"],
      rows: plans.map((i) => [i.student.studentNumber, name(i.student), i.plan.title, i.plan.isCancelled ? "İptal" : "", i.order, d(i.dueDate), tl(i.amount), tl(i.paidAmount), tl(Math.max(0, i.amount - i.paidAmount))]),
    },
    {
      name: "Tahsilatlar",
      headers: ["Makbuz No", "Tarih", "Öğrenci No", "Öğrenci", "Ödeyen", "Şekil", "Tutar (TL)", "Not", "İptal", "İptal sebebi"],
      rows: payments.map((p) => [p.receiptNo, dt(p.paidAt), p.student.studentNumber, name(p.student), p.payerName, PAYMENT_METHOD_LABEL[p.method], tl(p.amount), p.note, dt(p.cancelledAt), p.cancelReason]),
    },
    {
      name: "Giderler",
      headers: ["Tarih", "Tür", "Açıklama", "Ödenen", "Personel", "Tutar (TL)"],
      rows: expenses.map((e) => [d(e.date), EXPENSE_CATEGORY_LABEL[e.category], e.description, e.paidTo, name(e.member?.user), tl(e.amount)]),
    },
    {
      name: "Notlar",
      headers: ["Tarih", "Öğrenci No", "Öğrenci", "Tür", "Yazan", "Veliye açık", "Not"],
      rows: notes.map((n) => [dt(n.createdAt), n.student.studentNumber, name(n.student), NOTE_KIND_LABEL[n.kind], name(n.author?.user), n.visibleToParent ? "Evet" : "", n.text]),
    },
    {
      name: "Ön kayıtlar",
      headers: ["Tarih", "Öğrenci", "Veli", "Telefon", "E-posta", "Sınıf", "Kaynak", "Durum", "Mesaj", "Not"],
      rows: leads.map((l) => [dt(l.createdAt), l.studentName, l.parentName, l.phone, l.email, l.gradeName, l.source, LEAD_STATUS[l.status].label, l.message, l.note]),
    },
    {
      name: "Duyurular",
      headers: ["Tarih", "Kime", "Başlık", "Metin"],
      rows: announcements.map((a) => [dt(a.createdAt), a.group?.name ?? "Tüm kurum", a.title, a.body]),
    },
  ];
  return buildWorkbook(sheets);
}

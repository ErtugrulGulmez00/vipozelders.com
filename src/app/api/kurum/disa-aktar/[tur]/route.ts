import type { NextRequest } from "next/server";
import { ATTENDANCE_STATUS, EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL, STUDENT_STATUS } from "@/lib/center/labels";
import { STUDENT_TEMPLATE_HEADERS } from "@/lib/center/import";
import type { CenterPermission } from "@/lib/center/permissions";
import { csvMoney, csvResponse, toCsv, type CsvCell } from "@/lib/csv";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, formatCompact, isDateString, minutesToTime, toLocalDateString } from "@/lib/dates";
import { GENDER_LABEL } from "@/lib/labels";
import { attendanceReport } from "@/server/center/attendance";
import { centerBackupWorkbook } from "@/server/center/backup";
import { centerAudit, resolveCenter } from "@/server/center/context";
import { buildWorkbook, xlsxResponse } from "@/server/center/spreadsheet";
import { db } from "@/server/db";

const REQUIRED: Record<string, CenterPermission> = {
  ogrenciler: "students.view",
  "ogrenci-sablonu": "students.edit",
  "deneme-sablonu": "exams.manage",
  "deneme-sonuclari": "exams.manage",
  tahsilatlar: "finance.view",
  borclar: "finance.view",
  giderler: "expenses.manage",
  yoklama: "attendance.take",
  "tum-veriler": "settings.manage",
};

const d = (date: Date) => dbDateToString(date).split("-").reverse().join(".");

/** Kurum paneli Excel/CSV çıktıları ve içe aktarma şablonları. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/kurum/disa-aktar/[tur]">) {
  const resolved = await resolveCenter();
  if (resolved.kind !== "ok") return new Response("Yetkisiz.", { status: 403 });
  const { ctx } = resolved;
  const { tur } = await params;
  const permission = REQUIRED[tur];
  if (!permission) return new Response("Bulunamadı.", { status: 404 });
  if (!ctx.can(permission)) return new Response("Bu çıktı için yetkiniz yok.", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const centerId = ctx.center.id;
  const today = toLocalDateString(new Date());
  const from = isDateString(sp.get("baslangic") ?? "") ? sp.get("baslangic")! : addDaysToDateString(today, -30);
  const to = isDateString(sp.get("bitis") ?? "") ? sp.get("bitis")! : today;

  if (tur === "ogrenciler") {
    const status = sp.get("statu") ?? "ACTIVE";
    const groupId = sp.get("grup");
    const students = await db.centerStudent.findMany({
      where: { centerId, ...(status !== "ALL" ? { status: status as "ACTIVE" | "PASSIVE" | "LEFT" } : {}), ...(groupId ? { groups: { some: { groupId } } } : {}) },
      include: { guardians: { orderBy: { isPrimary: "desc" } }, groups: { include: { group: { select: { name: true } } } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    const csv = toCsv(
      ["Öğrenci No", "Ad", "Soyad", "Sınıf", "Okul", "Hedef", "Grup", "Cinsiyet", "Doğum Tarihi", "Telefon", "E-posta", "Veli Ad Soyad", "Yakınlık", "Veli Telefon", "Veli E-posta", "2. Veli", "2. Veli Telefon", "Durum", "Kayıt"],
      students.map((s) => [
        s.studentNumber,
        s.firstName,
        s.lastName,
        s.gradeName,
        s.schoolName,
        s.targetExam,
        s.groups.map((g) => g.group.name).join(", "),
        GENDER_LABEL[s.gender],
        s.birthDate ? d(s.birthDate) : "",
        s.phone,
        s.email,
        s.guardians[0]?.fullName,
        s.guardians[0]?.relation,
        s.guardians[0]?.phone,
        s.guardians[0]?.email,
        s.guardians[1]?.fullName,
        s.guardians[1]?.phone,
        STUDENT_STATUS[s.status].label,
        formatCompact(s.enrolledAt),
      ]),
    );
    return csvResponse(`ogrenciler-${today}.csv`, csv);
  }

  if (tur === "ogrenci-sablonu") {
    const data = await buildWorkbook([
      {
        name: "Öğrenciler",
        headers: STUDENT_TEMPLATE_HEADERS,
        rows: [
          ["1001", "Ali", "Yılmaz", "8. Sınıf", "Atatürk Ortaokulu", "LGS", "8-A", "Erkek", "14.05.2012", "", "", "Ayşe Yılmaz", "Anne", "0532 111 22 33", "ayse@example.com", "", ""],
          ["1002", "Zeynep", "Kaya", "8. Sınıf", "Cumhuriyet Ortaokulu", "LGS", "8-A", "Kız", "02.11.2012", "", "", "Mehmet Kaya", "Baba", "0533 444 55 66", "", "", ""],
        ],
        widths: [12, 14, 14, 12, 24, 12, 10, 10, 14, 16, 22, 20, 10, 16, 24, 24, 20],
        note: "Örnek satırları silip kendi öğrencilerinizi yazın. Zorunlu sütunlar: Ad ve Soyad.",
      },
    ]);
    return xlsxResponse("ogrenci-sablonu.xlsx", data);
  }

  if (tur === "deneme-sablonu" || tur === "deneme-sonuclari") {
    const exam = await db.centerExam.findFirst({ where: { id: sp.get("deneme") ?? "", centerId }, include: { sections: { orderBy: { order: "asc" } } } });
    if (!exam) return new Response("Deneme bulunamadı.", { status: 404 });
    if (tur === "deneme-sablonu") {
      const groupId = sp.get("grup");
      const withAnswers = sp.get("tip") === "cevap";
      const students = await db.centerStudent.findMany({
        where: { centerId, status: "ACTIVE", ...(groupId ? { groups: { some: { groupId } } } : {}) },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { studentNumber: true, firstName: true, lastName: true },
      });
      const sectionHeaders = exam.sections.flatMap((s) => (withAnswers ? [`${s.name} Cevap`] : [`${s.name} D`, `${s.name} Y`]));
      const data = await buildWorkbook([
        {
          name: "Sonuçlar",
          headers: ["Öğrenci No", "Ad Soyad", ...sectionHeaders, "Puan"],
          rows: students.map((s) => [s.studentNumber, `${s.firstName} ${s.lastName}`, ...sectionHeaders.map(() => null), null]),
          widths: [12, 26, ...sectionHeaders.map((h) => (withAnswers ? 44 : Math.max(10, h.length + 2))), 10],
          note: withAnswers ? "Cevapları boşluksuz yazın (ör. ABCDA-EBC…); boş bırakılan soru için - kullanın." : "Her ders için doğru (D) ve yanlış (Y) sayısını yazın; boş sayısı otomatik hesaplanır.",
        },
      ]);
      return xlsxResponse(`${exam.name.replace(/[^\p{L}\p{N}]+/gu, "-")}-sablon.xlsx`, data);
    }
    const results = await db.centerExamResult.findMany({
      where: { examId: exam.id },
      include: { sections: true, student: { select: { studentNumber: true, firstName: true, lastName: true, gradeName: true } } },
      orderBy: [{ rank: "asc" }, { net: "desc" }],
    });
    const csv = toCsv(
      ["Sıra", "Öğrenci No", "Ad Soyad", "Sınıf", ...exam.sections.flatMap((s) => [`${s.name} D`, `${s.name} Y`, `${s.name} B`, `${s.name} Net`]), "Toplam D", "Toplam Y", "Toplam B", "Toplam Net", "Puan"],
      results.map((r) => [
        r.rank,
        r.student.studentNumber,
        `${r.student.firstName} ${r.student.lastName}`,
        r.student.gradeName,
        ...exam.sections.flatMap((s): CsvCell[] => {
          const sr = r.sections.find((x) => x.sectionId === s.id);
          return sr ? [sr.correct, sr.wrong, sr.blank, sr.net] : [null, null, null, null];
        }),
        r.correct,
        r.wrong,
        r.blank,
        r.net,
        r.score,
      ]),
    );
    return csvResponse(`deneme-sonuclari-${today}.csv`, csv);
  }

  if (tur === "tahsilatlar") {
    const payments = await db.centerPayment.findMany({
      where: { centerId, paidAt: { gte: new Date(dateStringToDbDate(from).getTime() - 3 * 3_600_000), lt: new Date(dateStringToDbDate(addDaysToDateString(to, 1)).getTime() - 3 * 3_600_000) } },
      include: { student: { select: { studentNumber: true, firstName: true, lastName: true } } },
      orderBy: { receiptNo: "asc" },
    });
    const csv = toCsv(
      ["Makbuz No", "Tarih", "Öğrenci No", "Öğrenci", "Ödeyen", "Ödeme şekli", "Tutar (TL)", "Not", "Durum"],
      payments.map((p) => [
        p.receiptNo,
        toLocalDateString(p.paidAt).split("-").reverse().join("."),
        p.student.studentNumber,
        `${p.student.firstName} ${p.student.lastName}`,
        p.payerName,
        PAYMENT_METHOD_LABEL[p.method],
        csvMoney(p.amount),
        p.note,
        p.cancelledAt ? `İptal: ${p.cancelReason ?? ""}` : "Geçerli",
      ]),
    );
    return csvResponse(`tahsilatlar-${from}-${to}.csv`, csv);
  }

  if (tur === "borclar") {
    const installments = await db.centerInstallment.findMany({
      where: { centerId, plan: { isCancelled: false } },
      include: { plan: { select: { title: true } }, student: { select: { studentNumber: true, firstName: true, lastName: true, status: true, guardians: { orderBy: { isPrimary: "desc" }, take: 1, select: { fullName: true, phone: true } } } } },
      orderBy: [{ dueDate: "asc" }],
    });
    const csv = toCsv(
      ["Vade", "Öğrenci No", "Öğrenci", "Durum", "Plan", "Taksit", "Tutar (TL)", "Ödenen (TL)", "Kalan (TL)", "Gecikmiş", "Veli", "Veli Telefon"],
      installments
        .filter((i) => i.amount > i.paidAmount || sp.get("hepsi") === "1")
        .map((i) => [
          d(i.dueDate),
          i.student.studentNumber,
          `${i.student.firstName} ${i.student.lastName}`,
          STUDENT_STATUS[i.student.status].label,
          i.plan.title,
          i.order,
          csvMoney(i.amount),
          csvMoney(i.paidAmount),
          csvMoney(Math.max(0, i.amount - i.paidAmount)),
          dbDateToString(i.dueDate) < today && i.paidAmount < i.amount ? "Evet" : "",
          i.student.guardians[0]?.fullName,
          i.student.guardians[0]?.phone,
        ]),
    );
    return csvResponse(`borc-listesi-${today}.csv`, csv);
  }

  if (tur === "giderler") {
    const expenses = await db.centerExpense.findMany({
      where: { centerId, date: { gte: dateStringToDbDate(from), lte: dateStringToDbDate(to) } },
      include: { member: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: "asc" },
    });
    const csv = toCsv(
      ["Tarih", "Tür", "Açıklama", "Ödenen kişi/firma", "Personel", "Tutar (TL)"],
      expenses.map((e) => [d(e.date), EXPENSE_CATEGORY_LABEL[e.category], e.description, e.paidTo, e.member ? `${e.member.user.firstName} ${e.member.user.lastName}` : "", csvMoney(e.amount)]),
    );
    return csvResponse(`giderler-${from}-${to}.csv`, csv);
  }

  if (tur === "tum-veriler") {
    await centerAudit(ctx, "backup.download", "Center", centerId);
    return xlsxResponse(`${ctx.center.slug}-tum-veriler-${today}.xlsx`, await centerBackupWorkbook(centerId));
  }

  // yoklama
  const groupId = sp.get("grup") || undefined;
  if (sp.get("detay") === "1") {
    const records = await db.centerAttendance.findMany({
      where: { session: { centerId, date: { gte: dateStringToDbDate(from), lte: dateStringToDbDate(to) }, ...(groupId ? { groupId } : {}) } },
      include: { session: { select: { date: true, startMinute: true, subject: true, group: { select: { name: true } } } }, student: { select: { studentNumber: true, firstName: true, lastName: true } } },
      orderBy: [{ session: { date: "asc" } }, { session: { startMinute: "asc" } }],
    });
    const csv = toCsv(
      ["Tarih", "Saat", "Sınıf", "Ders", "Öğrenci No", "Öğrenci", "Durum", "Not"],
      records.map((r) => [d(r.session.date), minutesToTime(r.session.startMinute), r.session.group.name, r.session.subject, r.student.studentNumber, `${r.student.firstName} ${r.student.lastName}`, ATTENDANCE_STATUS[r.status].label, r.note]),
    );
    return csvResponse(`yoklama-detay-${from}-${to}.csv`, csv);
  }
  const rows = await attendanceReport(centerId, from, to, groupId);
  const csv = toCsv(
    ["Öğrenci No", "Öğrenci", "Ders", "Geldi", "Gelmedi", "Geç", "İzinli", "Devam %"],
    rows.map((r) => [r.studentNumber, r.name, r.total, r.present, r.absent, r.late, r.excused, Math.round(r.rate * 100)]),
  );
  return csvResponse(`devamsizlik-${from}-${to}.csv`, csv);
}

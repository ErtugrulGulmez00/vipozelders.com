// Kurum raporları (Dershane paketi): kurum → sınıf → öğrenci. Aynı ölçüler her seviyede:
// devam oranı (geldi + geç / işaretlenen), ödev yapma oranı (kısmen yarım sayılır), son denemenin ortalama neti,
// geciken ödeme. Hesap saf fonksiyondur; veriyi sunucu toplar (server/center/reports.ts).

export type AttendanceMark = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type HomeworkMark = "PENDING" | "DONE" | "PARTIAL" | "MISSING";

export type ReportInput = {
  students: { id: string; name: string; studentNumber: string | null; groupIds: string[] }[];
  groups: { id: string; name: string; gradeName: string | null }[];
  attendance: { studentId: string; status: AttendanceMark }[];
  homework: { studentId: string; status: HomeworkMark }[];
  /** Dönemdeki deneme sonuçları */
  exams: { examId: string; examName: string; date: string; studentId: string; net: number }[];
  /** Öğrenci başına geciken tutar (kuruş) */
  overdue: { studentId: string; amount: number }[];
};

export type ReportMetrics = {
  students: number;
  attendanceRate: number | null;
  absences: number;
  homeworkRate: number | null;
  /** Son denemenin adı ve ortalama neti (o denemeye giren öğrencilerle) */
  exam: { name: string; avgNet: number; participants: number } | null;
  overdue: number;
};

export type StudentReportRow = ReportMetrics & { id: string; name: string; studentNumber: string | null; lastNet: number | null };
export type GroupReportRow = ReportMetrics & { id: string; name: string; gradeName: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

function metrics(ids: Set<string>, input: ReportInput): ReportMetrics {
  const att = input.attendance.filter((a) => ids.has(a.studentId));
  const attended = att.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
  const hw = input.homework.filter((h) => ids.has(h.studentId) && h.status !== "PENDING");
  const hwDone = hw.filter((h) => h.status === "DONE").length + hw.filter((h) => h.status === "PARTIAL").length * 0.5;
  // Bu öğrencilerin girdiği en son deneme (tarih, eşitse ad)
  const results = input.exams.filter((e) => ids.has(e.studentId));
  const latest = results.reduce<(typeof results)[number] | null>((best, e) => (!best || e.date > best.date || (e.date === best.date && e.examId > best.examId) ? e : best), null);
  const latestResults = latest ? results.filter((e) => e.examId === latest.examId) : [];
  return {
    students: ids.size,
    attendanceRate: att.length ? attended / att.length : null,
    absences: att.filter((a) => a.status === "ABSENT").length,
    homeworkRate: hw.length ? hwDone / hw.length : null,
    exam: latest ? { name: latest.examName, avgNet: round2(latestResults.reduce((s, e) => s + e.net, 0) / latestResults.length), participants: latestResults.length } : null,
    overdue: input.overdue.filter((o) => ids.has(o.studentId)).reduce((s, o) => s + o.amount, 0),
  };
}

export function buildCenterReport(input: ReportInput): { total: ReportMetrics; groups: GroupReportRow[] } {
  const groups = input.groups.map((g) => ({ ...g, ...metrics(new Set(input.students.filter((s) => s.groupIds.includes(g.id)).map((s) => s.id)), input) }));
  return { total: metrics(new Set(input.students.map((s) => s.id)), input), groups };
}

export function buildStudentRows(input: ReportInput): StudentReportRow[] {
  return input.students
    .map((s) => {
      const own = metrics(new Set([s.id]), input);
      return { id: s.id, name: s.name, studentNumber: s.studentNumber, ...own, lastNet: own.exam?.avgNet ?? null };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

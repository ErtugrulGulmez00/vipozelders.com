import "server-only";
import { centerAccess } from "@/lib/center/subscription";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, toLocalDateString } from "@/lib/dates";
import type { CenterContext } from "./center/context";
import { CenterError } from "./center/errors";
import { weekStartOf } from "./center/resources";
import { db } from "./db";
import { kocPortalStudent, kocStudentOrThrow } from "./koc";

// Pi Koç: öğrencinin çalışma süresi ve koçun kendi tahsilatı (öğrenci başına aylık ücret).

// ---------------------------------------------------------------------------
// Çalışma süresi
// ---------------------------------------------------------------------------

export type StudyInput = { date: string; subject: string | null; minutes: number };

function checkStudy(input: StudyInput) {
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 720) throw new CenterError("Süre 1 ile 720 dakika arasında olmalı.", { minutes: "1-720 dakika." });
  if (input.date > toLocalDateString(new Date())) throw new CenterError("İleri tarihli çalışma girilemez.", { date: "Bugün ya da önceki bir gün." });
}

export async function addStudySession(ctx: CenterContext, studentId: string, input: StudyInput) {
  await kocStudentOrThrow(ctx, studentId);
  checkStudy(input);
  return db.centerStudySession.create({ data: { centerId: ctx.center.id, studentId, ...input, date: dateStringToDbDate(input.date) } });
}

export async function addPortalStudySession(userId: string, studentId: string, input: StudyInput) {
  const student = await kocPortalStudent(userId, studentId);
  if (!student) throw new CenterError("Kayıt bulunamadı.");
  if (!centerAccess(student.center).writable) throw new CenterError("Koçunuzun aboneliği yenilenene kadar yeni kayıt girilemiyor.");
  checkStudy(input);
  return db.centerStudySession.create({ data: { centerId: student.centerId, studentId, ...input, date: dateStringToDbDate(input.date), byStudent: true } });
}

/** Koç her kaydı, öğrenci yalnızca kendi girdiğini siler. */
export async function deleteStudySession(actor: { ctx?: CenterContext; userId?: string }, sessionId: string) {
  const row = await db.centerStudySession.findUnique({ where: { id: sessionId }, select: { id: true, centerId: true, studentId: true, byStudent: true } });
  if (!row) throw new CenterError("Kayıt bulunamadı.");
  const allowed = actor.ctx ? row.centerId === actor.ctx.center.id : Boolean(actor.userId && row.byStudent && (await kocPortalStudent(actor.userId, row.studentId)));
  if (!allowed) throw new CenterError("Kayıt bulunamadı.");
  await db.centerStudySession.delete({ where: { id: sessionId } });
}

/** Son 14 gün günlük dakika, bu/geçen hafta toplamı ve ders dağılımı (30 gün). */
export async function studyStats(studentId: string, today: string) {
  const from = addDaysToDateString(weekStartOf(today), -7);
  const since30 = addDaysToDateString(today, -29);
  const start = from < since30 ? from : since30;
  const rows = await db.centerStudySession.findMany({ where: { studentId, date: { gte: dateStringToDbDate(start) } }, select: { date: true, subject: true, minutes: true } });
  const sum = (filter: (d: string) => boolean) => rows.filter((r) => filter(dbDateToString(r.date))).reduce((t, r) => t + r.minutes, 0);
  const week = weekStartOf(today);
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = addDaysToDateString(today, i - 13);
    return { date, minutes: sum((d) => d === date) };
  });
  const bySubject = new Map<string, number>();
  for (const r of rows) if (dbDateToString(r.date) >= since30) bySubject.set(r.subject ?? "Genel", (bySubject.get(r.subject ?? "Genel") ?? 0) + r.minutes);
  return {
    days,
    thisWeek: sum((d) => d >= week),
    lastWeek: sum((d) => d >= from && d < week),
    subjects: [...bySubject.entries()].map(([subject, minutes]) => ({ subject, minutes })).sort((a, b) => b.minutes - a.minutes),
  };
}

export { formatMinutes } from "@/lib/koc-format";

// ---------------------------------------------------------------------------
// Koçun tahsilatı
// ---------------------------------------------------------------------------

export const isPeriod = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const periodLabel = (period: string) => `${MONTHS[Number(period.slice(5)) - 1]} ${period.slice(0, 4)}`;

export async function setMonthlyFee(ctx: CenterContext, studentId: string, fee: number | null) {
  await kocStudentOrThrow(ctx, studentId);
  if (fee !== null && (fee < 0 || fee > 10_000_000)) throw new CenterError("Aylık ücret geçersiz.", { monthlyFee: "Geçersiz tutar." });
  await db.centerStudent.update({ where: { id: studentId }, data: { monthlyFee: fee || null } });
}

export async function recordCoachPayment(ctx: CenterContext, studentId: string, input: { period: string; amount: number; method: string | null; note: string | null }) {
  await kocStudentOrThrow(ctx, studentId);
  if (!isPeriod(input.period)) throw new CenterError("Dönem geçersiz.");
  if (input.amount <= 0) throw new CenterError("Tutar sıfırdan büyük olmalı.", { amount: "Tutarı yazın." });
  return db.centerCoachPayment.upsert({
    where: { studentId_period: { studentId, period: input.period } },
    create: { centerId: ctx.center.id, studentId, period: input.period, amount: input.amount, method: input.method, note: input.note, paidAt: new Date() },
    update: { amount: input.amount, method: input.method, note: input.note },
  });
}

export async function deleteCoachPayment(ctx: CenterContext, paymentId: string) {
  const row = await db.centerCoachPayment.findFirst({ where: { id: paymentId, centerId: ctx.center.id }, select: { id: true } });
  if (!row) throw new CenterError("Kayıt bulunamadı.");
  await db.centerCoachPayment.delete({ where: { id: paymentId } });
}

/** Seçilen ayın tahsilat durumu ve son 6 ayın tahsil edilen toplamı. */
export async function coachFeeOverview(centerId: string, period: string) {
  const first = shiftPeriod(period, -5);
  const [students, payments] = await Promise.all([
    db.centerStudent.findMany({ where: { centerId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true, monthlyFee: true } }),
    db.centerCoachPayment.findMany({ where: { centerId, period: { gte: first, lte: period } }, select: { id: true, studentId: true, period: true, amount: true, paidAt: true, method: true } }),
  ]);
  const thisMonth = payments.filter((p) => p.period === period);
  const rows = students.map((s) => ({ ...s, payment: thisMonth.find((p) => p.studentId === s.id) ?? null }));
  // Arşivdeki öğrencinin bu ayki ödemesi de toplamlara girer
  const expected = rows.reduce((t, r) => t + (r.monthlyFee ?? 0), 0);
  const collected = thisMonth.reduce((t, p) => t + p.amount, 0);
  const months = Array.from({ length: 6 }, (_, i) => {
    const p = shiftPeriod(first, i);
    return { period: p, amount: payments.filter((x) => x.period === p).reduce((t, x) => t + x.amount, 0) };
  });
  return { rows, expected, collected, outstanding: rows.reduce((t, r) => t + (!r.payment && r.monthlyFee ? r.monthlyFee : 0), 0), months, missingFee: rows.filter((r) => !r.monthlyFee).length };
}

import { addDaysToDateString, dateStringToDbDate, dbDateToString, formatDate, toLocalDateString, toLocalMinutes } from "@/lib/dates";
import { allocatePayment, buildInstallments } from "@/lib/center/finance";
import { formatMoney } from "@/lib/money";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Kurum muhasebesi: öğrenci ödeme planları, tahsilat ve makbuz, iptal, gecikenler, hatırlatmalar, giderler, raporlar.

export type FeePlanInput = {
  studentId: string;
  title: string;
  totalAmount: number;
  discountAmount: number;
  count: number;
  firstDueDate: string;
  downPayment: number;
  downPaymentDate: string | null;
  note: string | null;
};

export async function createFeePlan(ctx: CenterContext, input: FeePlanInput) {
  const student = await db.centerStudent.findFirst({ where: { id: input.studentId, centerId: ctx.center.id } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  if (input.totalAmount <= 0) throw new CenterError("Toplam tutar sıfırdan büyük olmalı.", { totalAmount: "Tutar girin." });
  if (input.discountAmount < 0 || input.discountAmount >= input.totalAmount) throw new CenterError("İndirim toplam tutardan küçük olmalı.", { discountAmount: "Geçersiz indirim." });
  const netAmount = input.totalAmount - input.discountAmount;
  if (input.downPayment > netAmount) throw new CenterError("Peşinat net tutardan büyük olamaz.", { downPayment: "Geçersiz peşinat." });
  if (input.count < 1 || input.count > 36) throw new CenterError("Taksit sayısı 1-36 arasında olmalı.", { count: "1-36" });
  const installments = buildInstallments({
    netAmount,
    count: input.count,
    firstDueDate: input.firstDueDate,
    downPayment: input.downPayment,
    downPaymentDate: input.downPaymentDate ?? input.firstDueDate,
  });
  return db.centerFeePlan.create({
    data: {
      centerId: ctx.center.id,
      studentId: student.id,
      title: input.title,
      totalAmount: input.totalAmount,
      discountAmount: input.discountAmount,
      netAmount,
      note: input.note,
      installments: {
        create: installments.map((i) => ({ centerId: ctx.center.id, studentId: student.id, order: i.order, dueDate: dateStringToDbDate(i.dueDate), amount: i.amount })),
      },
    },
  });
}

/** Ödeme planı iptali: yapılmış tahsilatlar durur, kalan taksitler borç sayılmaz. */
export async function cancelFeePlan(ctx: CenterContext, planId: string) {
  const plan = await db.centerFeePlan.findFirst({ where: { id: planId, centerId: ctx.center.id } });
  if (!plan) throw new CenterError("Ödeme planı bulunamadı.");
  await db.centerFeePlan.update({ where: { id: planId }, data: { isCancelled: true } });
}

export async function updateInstallment(ctx: CenterContext, installmentId: string, input: { dueDate: string; amount: number }) {
  const inst = await db.centerInstallment.findFirst({ where: { id: installmentId, centerId: ctx.center.id }, include: { plan: true } });
  if (!inst) throw new CenterError("Taksit bulunamadı.");
  if (input.amount < inst.paidAmount) throw new CenterError(`Bu taksitten ${formatMoney(inst.paidAmount)} tahsil edilmiş; tutar bundan az olamaz.`);
  await db.$transaction(async (tx) => {
    await tx.centerInstallment.update({ where: { id: installmentId }, data: { dueDate: dateStringToDbDate(input.dueDate), amount: input.amount, remindedAt: null } });
    const sum = await tx.centerInstallment.aggregate({ where: { planId: inst.planId }, _sum: { amount: true } });
    await tx.centerFeePlan.update({ where: { id: inst.planId }, data: { netAmount: sum._sum.amount ?? 0, discountAmount: Math.max(0, inst.plan.totalAmount - (sum._sum.amount ?? 0)) } });
  });
}

export type PaymentInput = {
  studentId: string;
  amount: number;
  method: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  paidAt: Date;
  payerName: string | null;
  note: string | null;
  notify: boolean;
};

/** Tahsilat: sıradaki makbuz numarası alınır, tutar en eski taksitten başlayarak dağıtılır. */
export async function recordPayment(ctx: CenterContext, input: PaymentInput) {
  if (input.amount <= 0) throw new CenterError("Tutar sıfırdan büyük olmalı.", { amount: "Tutar girin." });
  const student = await db.centerStudent.findFirst({ where: { id: input.studentId, centerId: ctx.center.id } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  const payment = await db.$transaction(async (tx) => {
    const center = await tx.center.update({ where: { id: ctx.center.id }, data: { nextReceiptNo: { increment: 1 } }, select: { nextReceiptNo: true } });
    const receiptNo = center.nextReceiptNo - 1;
    const open = await tx.centerInstallment.findMany({ where: { studentId: student.id, centerId: ctx.center.id, plan: { isCancelled: false } } });
    const { allocations } = allocatePayment(
      open.map((i) => ({ id: i.id, order: i.order, dueDate: dbDateToString(i.dueDate), amount: i.amount, paidAmount: i.paidAmount })),
      input.amount,
    );
    const created = await tx.centerPayment.create({
      data: {
        centerId: ctx.center.id,
        studentId: student.id,
        receiptNo,
        amount: input.amount,
        method: input.method,
        paidAt: input.paidAt,
        payerName: input.payerName,
        note: input.note,
        createdById: ctx.user.id,
        allocations: { create: allocations },
      },
    });
    for (const a of allocations) await tx.centerInstallment.update({ where: { id: a.installmentId }, data: { paidAmount: { increment: a.amount } } });
    return created;
  });
  if (input.notify) {
    const name = `${student.firstName} ${student.lastName}`;
    await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: student.id,
      kind: "payment_receipt",
      sms: `${name} için ${formatMoney(payment.amount)} ödemeniz alınmıştır. Makbuz no: ${payment.receiptNo}. Teşekkür ederiz.`,
      email: { subject: `Ödemeniz alındı (makbuz ${payment.receiptNo})`, title: "Ödemeniz alındı", lines: [`${name} için ${formatMoney(payment.amount)} tutarındaki ödemeniz ${formatDate(payment.paidAt)} tarihinde alınmıştır.`, `Makbuz no: ${payment.receiptNo}`] },
      notification: { title: "Ödemeniz alındı", body: `${formatMoney(payment.amount)} · makbuz ${payment.receiptNo}` },
    });
  }
  return payment;
}

/** Tahsilat iptali: makbuz numarası korunur, taksitlere dağıtılan tutar geri alınır. */
export async function cancelPayment(ctx: CenterContext, paymentId: string, reason: string) {
  const payment = await db.centerPayment.findFirst({ where: { id: paymentId, centerId: ctx.center.id }, include: { allocations: true } });
  if (!payment) throw new CenterError("Tahsilat bulunamadı.");
  if (payment.cancelledAt) throw new CenterError("Bu tahsilat zaten iptal edilmiş.");
  await db.$transaction([
    db.centerPayment.update({ where: { id: paymentId }, data: { cancelledAt: new Date(), cancelReason: reason } }),
    ...payment.allocations.map((a) => db.centerInstallment.update({ where: { id: a.installmentId }, data: { paidAmount: { decrement: a.amount } } })),
    db.centerPaymentAllocation.deleteMany({ where: { paymentId } }),
  ]);
}

/** Öğrencinin toplam borcu, ödenen, kalan ve geciken tutarı. */
export async function studentBalance(centerId: string, studentId: string, today = toLocalDateString(new Date())) {
  const installments = await db.centerInstallment.findMany({ where: { centerId, studentId, plan: { isCancelled: false } }, select: { amount: true, paidAmount: true, dueDate: true } });
  const total = installments.reduce((t, i) => t + i.amount, 0);
  const paid = installments.reduce((t, i) => t + Math.min(i.paidAmount, i.amount), 0);
  const overdue = installments.filter((i) => dbDateToString(i.dueDate) < today).reduce((t, i) => t + Math.max(0, i.amount - i.paidAmount), 0);
  return { total, paid, remaining: total - paid, overdue };
}

export type OverdueRow = {
  studentId: string;
  name: string;
  studentNumber: string | null;
  gradeName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  amount: number;
  installments: number;
  oldestDue: string;
  lastReminded: Date | null;
};

/** Vadesi geçmiş, ödenmemiş taksitler öğrenci bazında (en eski vade başta). */
export async function overdueByStudent(centerId: string, today = toLocalDateString(new Date())): Promise<OverdueRow[]> {
  const installments = await db.centerInstallment.findMany({
    where: { centerId, dueDate: { lt: dateStringToDbDate(today) }, plan: { isCancelled: false }, student: { status: { not: "LEFT" } } },
    include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, gradeName: true, guardians: { where: { isStudentAccount: false }, orderBy: { isPrimary: "desc" }, take: 1, select: { fullName: true, phone: true } } } } },
    orderBy: { dueDate: "asc" },
  });
  const rows = new Map<string, OverdueRow>();
  for (const inst of installments) {
    const open = inst.amount - inst.paidAmount;
    if (open <= 0) continue;
    const s = inst.student;
    const row = rows.get(s.id) ?? {
      studentId: s.id,
      name: `${s.firstName} ${s.lastName}`,
      studentNumber: s.studentNumber,
      gradeName: s.gradeName,
      guardianName: s.guardians[0]?.fullName ?? null,
      guardianPhone: s.guardians[0]?.phone ?? null,
      amount: 0,
      installments: 0,
      oldestDue: dbDateToString(inst.dueDate),
      lastReminded: null,
    };
    row.amount += open;
    row.installments++;
    if (inst.remindedAt && (!row.lastReminded || inst.remindedAt > row.lastReminded)) row.lastReminded = inst.remindedAt;
    rows.set(s.id, row);
  }
  return [...rows.values()].sort((a, b) => a.oldestDue.localeCompare(b.oldestDue) || b.amount - a.amount);
}

/** Seçilen öğrencilerin velilerine geciken ödeme hatırlatması. */
export async function remindOverdue(ctx: CenterContext, studentIds: string[], channels: { sms: boolean; email: boolean }) {
  const today = toLocalDateString(new Date());
  const rows = (await overdueByStudent(ctx.center.id, today)).filter((r) => studentIds.includes(r.studentId));
  for (const row of rows) {
    await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: row.studentId,
      kind: "payment_overdue",
      channels,
      sms: `Sayın veli, ${row.name} için vadesi geçmiş ${formatMoney(row.amount)} ödemeniz bulunmaktadır. Bilgi için kurumumuzu arayabilirsiniz.${ctx.center.phone ? ` ${ctx.center.phone}` : ""}`,
      email: { subject: "Geciken ödeme hatırlatması", title: "Ödeme hatırlatması", lines: [`${row.name} için vadesi geçmiş ${formatMoney(row.amount)} tutarında ödemeniz bulunmaktadır (${row.installments} taksit).`, "Ödemenizi yaptıysanız bu mesajı dikkate almayın."] },
      notification: { title: "Geciken ödeme", body: `${row.name} · ${formatMoney(row.amount)}` },
    });
    await db.centerInstallment.updateMany({ where: { studentId: row.studentId, dueDate: { lt: dateStringToDbDate(today) } }, data: { remindedAt: new Date() } });
  }
  return rows.length;
}

/**
 * Zamanlayıcı görevi: vadesine N gün kalan taksitler için bir kez, vadesi geçen için bir kez
 * otomatik hatırlatma. Mesajlar yalnızca 10:00-20:00 arasında gönderilir.
 */
export async function sendCenterPaymentReminders(now = new Date()): Promise<number> {
  const minutes = toLocalMinutes(now);
  if (minutes < 10 * 60 || minutes > 20 * 60) return 0;
  const today = toLocalDateString(now);
  const installments = await db.centerInstallment.findMany({
    where: {
      dueDate: { gte: dateStringToDbDate(addDaysToDateString(today, -30)), lte: dateStringToDbDate(addDaysToDateString(today, 14)) },
      plan: { isCancelled: false, center: { remindPayments: true, status: { not: "SUSPENDED" } } },
      student: { status: "ACTIVE" },
    },
    include: { plan: { select: { center: { select: { id: true, name: true, phone: true, reminderDaysBefore: true } } } }, student: { select: { firstName: true, lastName: true } } },
    take: 500,
  });
  let sent = 0;
  for (const inst of installments) {
    const open = inst.amount - inst.paidAmount;
    if (open <= 0) continue;
    const due = dbDateToString(inst.dueDate);
    const center = inst.plan.center;
    const upcoming = due >= today && due <= addDaysToDateString(today, center.reminderDaysBefore) && !inst.remindedAt;
    const overdue = due < today && (!inst.remindedAt || toLocalDateString(inst.remindedAt) <= due);
    if (!upcoming && !overdue) continue;
    const name = `${inst.student.firstName} ${inst.student.lastName}`;
    const [y, m, d] = due.split("-");
    const dueText = `${d}.${m}.${y}`;
    await messageGuardians({
      centerId: center.id,
      centerName: center.name,
      studentId: inst.studentId,
      kind: upcoming ? "payment_reminder" : "payment_overdue",
      sms: upcoming
        ? `Sayın veli, ${name} için ${dueText} vadeli ${formatMoney(open)} taksit ödemenizi hatırlatırız.`
        : `Sayın veli, ${name} için ${dueText} vadeli ${formatMoney(open)} taksit ödemeniz gecikmiştir.${center.phone ? ` Bilgi: ${center.phone}` : ""}`,
      email: {
        subject: upcoming ? "Taksit hatırlatması" : "Geciken taksit",
        title: upcoming ? "Yaklaşan taksit ödemesi" : "Geciken taksit ödemesi",
        lines: [`${name} için ${dueText} vadeli ${formatMoney(open)} tutarında taksitiniz ${upcoming ? "yaklaşıyor" : "gecikmiştir"}.`, "Ödemenizi yaptıysanız bu mesajı dikkate almayın."],
      },
      notification: { title: upcoming ? "Yaklaşan taksit" : "Geciken taksit", body: `${name} · ${dueText} · ${formatMoney(open)}` },
    });
    await db.centerInstallment.update({ where: { id: inst.id }, data: { remindedAt: now } });
    sent++;
  }
  return sent;
}

export type ExpenseInput = {
  category: "RENT" | "SALARY" | "UTILITY" | "SUPPLIES" | "MARKETING" | "TAX" | "OTHER";
  amount: number;
  date: string;
  description: string | null;
  paidTo: string | null;
  memberId: string | null;
};

export async function createExpense(ctx: CenterContext, input: ExpenseInput) {
  if (input.amount <= 0) throw new CenterError("Tutar sıfırdan büyük olmalı.", { amount: "Tutar girin." });
  if (input.memberId && !(await db.centerMember.findFirst({ where: { id: input.memberId, centerId: ctx.center.id } }))) throw new CenterError("Personel bulunamadı.");
  return db.centerExpense.create({ data: { ...input, date: dateStringToDbDate(input.date), centerId: ctx.center.id, createdById: ctx.user.id } });
}

export async function deleteExpense(ctx: CenterContext, expenseId: string) {
  const expense = await db.centerExpense.findFirst({ where: { id: expenseId, centerId: ctx.center.id } });
  if (!expense) throw new CenterError("Gider bulunamadı.");
  await db.centerExpense.delete({ where: { id: expenseId } });
}

/** Aylık gelir (iptal edilmemiş tahsilatlar) ve gider; son N ay. */
export async function monthlyFinance(centerId: string, months = 12, now = new Date()) {
  const today = toLocalDateString(now);
  const [y, m] = today.split("-").map(Number);
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const from = dateStringToDbDate(`${keys[0]}-01`);
  const [payments, expenses] = await Promise.all([
    db.centerPayment.findMany({ where: { centerId, cancelledAt: null, paidAt: { gte: new Date(from.getTime() - 3 * 3_600_000) } }, select: { amount: true, paidAt: true, method: true } }),
    db.centerExpense.findMany({ where: { centerId, date: { gte: from } }, select: { amount: true, date: true, category: true } }),
  ]);
  const income = new Map(keys.map((k) => [k, 0]));
  const expense = new Map(keys.map((k) => [k, 0]));
  for (const p of payments) {
    const key = toLocalDateString(p.paidAt).slice(0, 7);
    if (income.has(key)) income.set(key, income.get(key)! + p.amount);
  }
  for (const e of expenses) {
    const key = dbDateToString(e.date).slice(0, 7);
    if (expense.has(key)) expense.set(key, expense.get(key)! + e.amount);
  }
  return keys.map((key) => ({ month: key, income: income.get(key)!, expense: expense.get(key)! }));
}

/** Kurumun genel finans tablosu: sözleşme toplamı, tahsil edilen, kalan, geciken; bu ay beklenen ve tahsil edilen. */
export async function financeOverview(centerId: string, now = new Date()) {
  const today = toLocalDateString(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = (() => {
    const [y, m] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  })();
  const [installments, monthPayments, monthExpenses] = await Promise.all([
    db.centerInstallment.findMany({ where: { centerId, plan: { isCancelled: false }, student: { status: { not: "LEFT" } } }, select: { amount: true, paidAmount: true, dueDate: true } }),
    db.centerPayment.aggregate({ where: { centerId, cancelledAt: null, paidAt: { gte: new Date(dateStringToDbDate(monthStart).getTime() - 3 * 3_600_000) } }, _sum: { amount: true }, _count: true }),
    db.centerExpense.aggregate({ where: { centerId, date: { gte: dateStringToDbDate(monthStart), lt: dateStringToDbDate(nextMonth) } }, _sum: { amount: true } }),
  ]);
  let contracted = 0;
  let collected = 0;
  let overdue = 0;
  let dueThisMonth = 0;
  for (const i of installments) {
    contracted += i.amount;
    collected += Math.min(i.paidAmount, i.amount);
    const due = dbDateToString(i.dueDate);
    if (due < today) overdue += Math.max(0, i.amount - i.paidAmount);
    if (due >= monthStart && due < nextMonth) dueThisMonth += i.amount;
  }
  return {
    contracted,
    collected,
    remaining: contracted - collected,
    overdue,
    dueThisMonth,
    collectedThisMonth: monthPayments._sum.amount ?? 0,
    paymentsThisMonth: monthPayments._count,
    expensesThisMonth: monthExpenses._sum.amount ?? 0,
  };
}

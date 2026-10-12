"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { zonedDateTime } from "@/lib/dates";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { cancelFeePlan, cancelPayment, createExpense, createFeePlan, deleteExpense, recordPayment, remindOverdue, updateInstallment, type ExpenseInput } from "@/server/center/finance";
import { bool, date, guard, int, list, money, opt, requiredText, str } from "@/server/center/form";

export async function createFeePlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("finance.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const totalAmount = money(formData, "totalAmount", "Toplam tutar");
    const discountPercent = int(formData, "discountPercent", 0, 0, 100);
    const discountAmount = discountPercent ? Math.round((totalAmount * discountPercent) / 100) : money(formData, "discountAmount", "İndirim", { allowZero: true });
    const downPayment = money(formData, "downPayment", "Peşinat", { allowZero: true });
    const plan = await createFeePlan(auth.ctx, {
      studentId: str(formData, "studentId"),
      title: requiredText(formData, "title", "Plan adı", 2, 120),
      totalAmount,
      discountAmount,
      count: int(formData, "count", 1, 1, 36),
      firstDueDate: date(formData, "firstDueDate", "İlk taksit tarihi"),
      downPayment,
      downPaymentDate: downPayment ? date(formData, "downPaymentDate", "Peşinat tarihi") : null,
      note: opt(formData, "note", 500),
    });
    await centerAudit(auth.ctx, "fee_plan.create", "CenterFeePlan", plan.id, { netAmount: plan.netAmount });
    refresh();
    return success("Ödeme planı oluşturuldu.");
  });
}

export async function cancelFeePlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("finance.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await cancelFeePlan(auth.ctx, str(formData, "planId"));
    await centerAudit(auth.ctx, "fee_plan.cancel", "CenterFeePlan", str(formData, "planId"));
    refresh();
    return success("Ödeme planı iptal edildi; kalan taksitler borç olarak sayılmayacak.");
  });
}

export async function updateInstallmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("finance.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await updateInstallment(auth.ctx, str(formData, "installmentId"), { dueDate: date(formData, "dueDate", "Vade"), amount: money(formData, "amount", "Taksit tutarı") });
    refresh();
    return success("Taksit güncellendi.");
  });
}

const METHODS = ["CASH", "CARD", "TRANSFER", "OTHER"] as const;

export async function recordPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("finance.edit");
  if (!auth.ok) return auth.state;
  let paymentId = "";
  const result = await guard(async () => {
    const method = str(formData, "method") as (typeof METHODS)[number];
    if (!METHODS.includes(method)) throw new CenterError("Ödeme şeklini seçin.", { method: "Seçin." });
    const studentId = str(formData, "studentId");
    if (!studentId) throw new CenterError("Öğrenci seçin.", { studentId: "Öğrenci seçin." });
    const paidOn = date(formData, "paidAt", "Ödeme tarihi");
    const payment = await recordPayment(auth.ctx, {
      studentId,
      amount: money(formData, "amount"),
      method,
      // Saat bilgisi yoksa öğlen 12:00 kabul edilir (gün kaymasın).
      paidAt: zonedDateTime(paidOn, 12 * 60),
      payerName: opt(formData, "payerName", 80),
      note: opt(formData, "note", 300),
      notify: bool(formData, "notify"),
    });
    paymentId = payment.id;
    await centerAudit(auth.ctx, "payment.create", "CenterPayment", payment.id, { amount: payment.amount, receiptNo: payment.receiptNo });
    return success();
  });
  if (!result.ok) return result;
  redirect(`/kurum/muhasebe/makbuz/${paymentId}?durum=tahsilat`);
}

export async function cancelPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("finance.edit");
  if (!auth.ok) return auth.state;
  const reason = str(formData, "reason", 200);
  if (reason.length < 3) return failure("İptal sebebini yazın.", { reason: "Sebep gerekli." });
  return guard(async () => {
    await cancelPayment(auth.ctx, str(formData, "paymentId"), reason);
    await centerAudit(auth.ctx, "payment.cancel", "CenterPayment", str(formData, "paymentId"), { reason });
    refresh();
    return success("Tahsilat iptal edildi; tutar taksitlerden geri alındı.");
  });
}

export async function remindOverdueAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("finance.edit");
  if (!auth.ok) return auth.state;
  const studentIds = list(formData, "studentIds");
  if (!studentIds.length) return failure("Hatırlatma gönderilecek öğrencileri seçin.");
  const sms = bool(formData, "sms");
  const email = bool(formData, "email");
  if (!sms && !email) return failure("SMS ya da e-posta seçin.");
  const count = await remindOverdue(auth.ctx, studentIds, { sms, email });
  refresh();
  return success(`${count} öğrencinin velisine hatırlatma sıraya alındı.`);
}

const CATEGORIES: ExpenseInput["category"][] = ["RENT", "SALARY", "UTILITY", "SUPPLIES", "MARKETING", "TAX", "OTHER"];

export async function createExpenseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("expenses.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const category = str(formData, "category") as ExpenseInput["category"];
    if (!CATEGORIES.includes(category)) throw new CenterError("Gider türünü seçin.", { category: "Seçin." });
    const expense = await createExpense(auth.ctx, {
      category,
      amount: money(formData, "amount"),
      date: date(formData, "date"),
      description: opt(formData, "description", 200),
      paidTo: opt(formData, "paidTo", 80),
      memberId: opt(formData, "memberId"),
    });
    await centerAudit(auth.ctx, "expense.create", "CenterExpense", expense.id, { amount: expense.amount });
    refresh();
    return success("Gider kaydedildi.");
  });
}

export async function deleteExpenseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("expenses.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteExpense(auth.ctx, str(formData, "expenseId"));
    await centerAudit(auth.ctx, "expense.delete", "CenterExpense", str(formData, "expenseId"));
    refresh();
    return success("Gider silindi.");
  });
}

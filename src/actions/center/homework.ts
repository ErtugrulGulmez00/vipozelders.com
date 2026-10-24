"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { success, type ActionState } from "@/lib/action-state";
import { centerAction, centerAudit } from "@/server/center/context";
import { bool, date, guard, list, opt, requiredText, str } from "@/server/center/form";
import { checkHomework, createHomework, deleteHomework, type HomeworkStatusName } from "@/server/center/homework";

const STATUSES: HomeworkStatusName[] = ["PENDING", "DONE", "PARTIAL", "MISSING"];

export async function createHomeworkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("homework.manage");
  if (!auth.ok) return auth.state;
  let id = "";
  const result = await guard(async () => {
    const { homework, count } = await createHomework(auth.ctx, {
      groupId: opt(formData, "groupId"),
      studentIds: list(formData, "studentIds"),
      subject: requiredText(formData, "subject", "Ders", 2, 60),
      title: requiredText(formData, "title", "Ödev", 3, 160),
      description: opt(formData, "description", 2000),
      assignedOn: date(formData, "assignedOn", "Veriliş tarihi"),
      dueDate: date(formData, "dueDate", "Teslim tarihi"),
      notifyWhatsapp: bool(formData, "notifyWhatsapp"),
    });
    id = homework.id;
    return success(`Ödev ${count} öğrenciye verildi.`);
  });
  if (!result.ok) return result;
  redirect(`/kurum/odevler/${id}?durum=odev-verildi`);
}

export async function checkHomeworkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("homework.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const records = list(formData, "studentIds").map((studentId) => {
      const status = str(formData, `status:${studentId}`) as HomeworkStatusName;
      return { studentId, status: STATUSES.includes(status) ? status : "PENDING", note: opt(formData, `note:${studentId}`, 200) };
    });
    const { saved, notified } = await checkHomework(auth.ctx, str(formData, "homeworkId"), records, bool(formData, "notify"));
    refresh();
    return success(`${saved} öğrencinin ödev durumu kaydedildi.${notified ? ` ${notified} öğrencinin velisine bildirim gönderildi.` : ""}`);
  });
}

export async function deleteHomeworkAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("homework.manage");
  if (!auth.ok) return auth.state;
  const homeworkId = str(formData, "homeworkId");
  const result = await guard(async () => {
    await deleteHomework(auth.ctx, homeworkId);
    await centerAudit(auth.ctx, "homework.delete", "CenterHomework", homeworkId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/kurum/odevler?durum=odev-silindi");
}

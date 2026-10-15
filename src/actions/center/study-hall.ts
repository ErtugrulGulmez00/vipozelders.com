"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { success, type ActionState } from "@/lib/action-state";
import { centerAction, centerAudit } from "@/server/center/context";
import { bool, date, guard, list, opt, requiredText, str } from "@/server/center/form";
import { addHallStudents, createHall, deleteHall, parsePeriods, saveHallDay, updateHall, updateHallStudent } from "@/server/center/study-hall";

export async function createHallAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("attendance.take");
  if (!auth.ok) return auth.state;
  let id = "";
  const result = await guard(async () => {
    id = (await createHall(auth.ctx, { name: requiredText(formData, "name", "Salon adı", 2, 60), periods: parsePeriods(str(formData, "periods", 2000)) })).id;
    return success();
  });
  if (!result.ok) return result;
  redirect(`/kurum/calisma-salonu/${id}?durum=salon-eklendi`);
}

export async function updateHallAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("attendance.take");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await updateHall(auth.ctx, str(formData, "hallId"), { name: requiredText(formData, "name", "Salon adı", 2, 60), periods: parsePeriods(str(formData, "periods", 2000)), isActive: !bool(formData, "archived") });
    refresh();
    return success("Salon güncellendi.");
  });
}

export async function deleteHallAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  const hallId = str(formData, "hallId");
  const result = await guard(async () => {
    await deleteHall(auth.ctx, hallId);
    await centerAudit(auth.ctx, "hall.delete", "CenterStudyHall", hallId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/kurum/calisma-salonu?durum=salon-silindi");
}

export async function addHallStudentsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("attendance.take");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const added = await addHallStudents(auth.ctx, str(formData, "hallId"), { groupId: opt(formData, "groupId"), studentIds: list(formData, "studentIds") });
    refresh();
    return success(added ? `${added} öğrenci salona eklendi.` : "Seçilen öğrenciler zaten salonda.");
  });
}

export async function updateHallStudentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("attendance.take");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await updateHallStudent(auth.ctx, str(formData, "hallId"), str(formData, "studentId"), opt(formData, "deskNo", 10), bool(formData, "remove"));
    refresh();
    return success();
  });
}

export async function saveHallDayAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("attendance.take");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const rows = list(formData, "studentIds").map((studentId) => ({ studentId, marks: str(formData, `marks:${studentId}`, 32) }));
    const { saved, notified } = await saveHallDay(auth.ctx, str(formData, "hallId"), date(formData, "date"), rows, bool(formData, "notify"));
    refresh();
    return success(`${saved} öğrencinin salon yoklaması kaydedildi.${notified ? ` Gün boyu gelmeyen ${notified} öğrencinin velisine bildirim gitti.` : ""}`);
  });
}

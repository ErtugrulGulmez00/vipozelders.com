"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { centerAction, centerAudit } from "@/server/center/context";
import { bool, date, guard, int, list, opt, requiredText, str } from "@/server/center/form";
import {
  addPlanItem,
  assignResource,
  copyPlanWeek,
  createResource,
  deletePlanItem,
  deleteResource,
  parseTopics,
  portalStudentIdFor,
  saveResourceProgress,
  setPlanItemDone,
  unassignResource,
  updateResource,
} from "@/server/center/resources";
import { db } from "@/server/db";

function resourceInput(formData: FormData) {
  return {
    name: requiredText(formData, "name", "Kaynak adı", 2, 120),
    subject: requiredText(formData, "subject", "Ders", 2, 60),
    publisher: opt(formData, "publisher", 80),
    topics: parseTopics(str(formData, "topics", 20_000)),
  };
}

export async function createResourceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  let id = "";
  const result = await guard(async () => {
    id = (await createResource(auth.ctx, resourceInput(formData))).id;
    return success();
  });
  if (!result.ok) return result;
  redirect(`/kurum/kaynaklar/${id}?durum=kaynak-eklendi`);
}

export async function updateResourceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await updateResource(auth.ctx, str(formData, "resourceId"), { ...resourceInput(formData), isActive: !bool(formData, "archived") });
    refresh();
    return success("Kaynak güncellendi.");
  });
}

export async function deleteResourceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  const resourceId = str(formData, "resourceId");
  const result = await guard(async () => {
    await deleteResource(auth.ctx, resourceId);
    await centerAudit(auth.ctx, "resource.delete", "CenterResource", resourceId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/kurum/kaynaklar?durum=kaynak-silindi");
}

export async function assignResourceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const { added, total } = await assignResource(auth.ctx, str(formData, "resourceId"), { groupId: opt(formData, "groupId"), studentIds: list(formData, "studentIds") });
    refresh();
    return success(added ? `Kaynak ${added} öğrenciye atandı.` : `Seçilen ${total} öğrenciye zaten atanmış.`);
  });
}

export async function unassignResourceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await unassignResource(auth.ctx, str(formData, "studentResourceId"));
    refresh();
    return success("Kaynak öğrenciden kaldırıldı.");
  });
}

function progressRows(formData: FormData) {
  return list(formData, "topics").map((topic) => ({
    topic,
    solved: int(formData, `solved:${topic}`, 0, 0),
    correct: int(formData, `correct:${topic}`, 0, 0),
    wrong: int(formData, `wrong:${topic}`, 0, 0),
    done: bool(formData, `done:${topic}`),
  }));
}

/** Kurum personeli öğrencinin kaynak ilerlemesini kaydeder. */
export async function saveProgressAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const id = str(formData, "studentResourceId");
    const owned = await db.centerStudentResource.findFirst({ where: { id, student: { centerId: auth.ctx.center.id } }, select: { id: true } });
    if (!owned) return failure("Kayıt bulunamadı.");
    await saveResourceProgress(id, progressRows(formData));
    refresh();
    return success("İlerleme kaydedildi.");
  });
}

export async function addPlanItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const target = int(formData, "targetQuestions", 0, 0, 2000);
    await addPlanItem(auth.ctx, str(formData, "studentId"), {
      date: date(formData, "date", "Gün"),
      subject: requiredText(formData, "subject", "Ders", 2, 60),
      topic: opt(formData, "topic", 160),
      resourceId: opt(formData, "resourceId"),
      targetQuestions: target || null,
      note: opt(formData, "note", 300),
    });
    refresh();
    return success("Programa eklendi.");
  });
}

export async function deletePlanItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deletePlanItem(auth.ctx, str(formData, "itemId"));
    refresh();
    return success();
  });
}

export async function copyPlanWeekAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const count = await copyPlanWeek(auth.ctx, str(formData, "studentId"), date(formData, "weekStart", "Hafta"));
    refresh();
    return success(`${count} madde sonraki haftaya kopyalandı.`);
  });
}

export async function togglePlanItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("resources.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const item = await db.centerStudyPlanItem.findFirst({ where: { id: str(formData, "itemId"), centerId: auth.ctx.center.id }, select: { id: true } });
    if (!item) return failure("Kayıt bulunamadı.");
    await setPlanItemDone(item.id, bool(formData, "done"));
    refresh();
    return success();
  });
}

// ---------------------------------------------------------------------------
// Veli / öğrenci portalı
// ---------------------------------------------------------------------------

/** Öğrenci ya da velisi programdaki maddeyi tamamlandı işaretler. */
export async function portalTogglePlanItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser();
  if (!user) return failure("Oturumunuz kapanmış.");
  const item = await db.centerStudyPlanItem.findUnique({ where: { id: str(formData, "itemId") }, select: { id: true, studentId: true } });
  if (!item || !(await portalStudentIdFor(user.id, item.studentId))) return failure("Kayıt bulunamadı.");
  await setPlanItemDone(item.id, bool(formData, "done"));
  refresh();
  return success();
}

/** Öğrenci ya da velisi kaynak ilerlemesini girer. */
export async function portalSaveProgressAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser();
  if (!user) return failure("Oturumunuz kapanmış.");
  const row = await db.centerStudentResource.findUnique({ where: { id: str(formData, "studentResourceId") }, select: { id: true, studentId: true } });
  if (!row || !(await portalStudentIdFor(user.id, row.studentId))) return failure("Kayıt bulunamadı.");
  await saveResourceProgress(row.id, progressRows(formData));
  refresh();
  return success("İlerleme kaydedildi.");
}

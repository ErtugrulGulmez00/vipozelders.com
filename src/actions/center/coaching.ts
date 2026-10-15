"use server";

import { refresh } from "next/cache";
import { success, type ActionState } from "@/lib/action-state";
import { timeToMinutes } from "@/lib/dates";
import { addCoachingSession, deleteCoachingSession, saveCoachAssignments } from "@/server/center/coaching";
import { centerAction } from "@/server/center/context";
import { bool, date, guard, list, opt, str } from "@/server/center/form";

export async function saveCoachAssignmentsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("coaching.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const rows = list(formData, "studentIds").map((studentId) => ({
      studentId,
      coachId: opt(formData, `coach:${studentId}`),
      weekday: Number(str(formData, `weekday:${studentId}`)) || null,
      minute: timeToMinutes(str(formData, `time:${studentId}`)),
    }));
    const saved = await saveCoachAssignments(auth.ctx, rows);
    refresh();
    return success(`${saved} öğrencinin koç ve görüşme saati kaydedildi.`);
  });
}

export async function addCoachingSessionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("coaching.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await addCoachingSession(auth.ctx, {
      studentId: str(formData, "studentId"),
      date: date(formData, "date", "Görüşme tarihi"),
      held: !bool(formData, "missed"),
      notes: str(formData, "notes", 4000),
      priorityTopics: str(formData, "priorityTopics", 1000).split(/[,\n]+/),
      nextGoal: opt(formData, "nextGoal", 500),
      visibleToParent: bool(formData, "visibleToParent"),
    });
    refresh();
    return success("Görüşme kaydedildi.");
  });
}

export async function deleteCoachingSessionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("coaching.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteCoachingSession(auth.ctx, str(formData, "sessionId"));
    refresh();
    return success();
  });
}

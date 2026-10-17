"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { reportClassroom, ReportError, resolveClassroomReport } from "@/server/classroom-reports";

/** Sanal sınıftan "uygunsuz durum bildir": ders odası kapanır, yöneticiye acil bildirim gider. */
export async function reportClassroomAction(bookingId: string, reason: string, details: string): Promise<ActionState> {
  const user = await actionUser("STUDENT", "TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    await reportClassroom(bookingId, user.id, reason, details || null);
    return success("Bildiriminiz alındı. Ders odası kapatıldı; ekibimiz hemen inceleyecek.");
  } catch (error) {
    if (error instanceof ReportError) return failure(error.message);
    throw error;
  }
}

export async function resolveClassroomReportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    const restore = formData.get("decision") === "restore";
    await resolveClassroomReport(user.id, String(formData.get("id") ?? ""), restore, String(formData.get("note") ?? ""));
    refresh();
    return success(restore ? "Bildirim kapatıldı; öğretmen yeniden yayında." : "Bildirim kapatıldı; öğretmen askıda kaldı.");
  } catch (error) {
    if (error instanceof ReportError) return failure(error.message);
    throw error;
  }
}

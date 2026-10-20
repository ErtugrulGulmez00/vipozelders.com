"use server";

import { refresh, updateTag } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { audit } from "@/server/audit";
import { actionUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { TEACHERS_CACHE_TAG } from "@/server/teachers";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Mesaj denetimi: konuşma incelendi; öğretmen uyarılır ya da askıya alınır. */
export async function moderateThreadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Oturumunuz kapanmış.");
  const thread = await db.messageThread.findUnique({ where: { id: text(formData, "threadId") }, select: { id: true, teacherId: true } });
  if (!thread) return failure("Konuşma bulunamadı.");
  const decision = text(formData, "decision");
  const note = text(formData, "note").slice(0, 500);
  const now = new Date();

  if (decision === "warn") {
    await notify({
      userId: thread.teacherId,
      type: "teacher.warning",
      title: "Resmî uyarı: platform kuralları",
      body: `Yazışmalarınızda kişisel iletişim bilgisi paylaşımı ya da platform dışına yönlendirme tespit edildi.${note ? ` Not: ${note}` : ""} Tekrarı hâlinde hesabınız kalıcı olarak kapatılır.`,
      link: "/ogretmen-paneli",
    });
  } else if (decision === "suspend") {
    await db.teacherProfile.update({ where: { userId: thread.teacherId }, data: { status: "SUSPENDED" } });
    await notify({
      userId: thread.teacherId,
      type: "teacher.suspended",
      title: "Hesabınız askıya alındı",
      body: `Platform kurallarına aykırı yazışmalar nedeniyle profiliniz yayından kaldırıldı.${note ? ` Not: ${note}` : ""} İtiraz için destek ekibine yazın.`,
      link: "/ogretmen-paneli",
    });
    updateTag(TEACHERS_CACHE_TAG);
  } else if (decision !== "reviewed") {
    return failure("Geçersiz işlem.");
  }
  await db.messageThread.update({ where: { id: thread.id }, data: { reviewedAt: now } });
  await audit({ actorId: admin.id, action: `messages.${decision}`, entityType: "MessageThread", entityId: thread.id, details: { teacherId: thread.teacherId, note } });
  refresh();
  return success(decision === "warn" ? "Öğretmene uyarı gönderildi." : decision === "suspend" ? "Öğretmen askıya alındı; profili aramada görünmüyor." : "İncelendi olarak işaretlendi.");
}

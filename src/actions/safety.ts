"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { blockUser, reportContent, SafetyError, unblockUser, type ReportKind } from "@/server/safety";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const KINDS: ReportKind[] = ["message", "thread", "inquiry", "user"];

export async function reportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser();
  if (!user) return failure("Oturumunuz kapanmış.");
  const kind = text(formData, "kind") as ReportKind;
  if (!KINDS.includes(kind)) return failure("Geçersiz istek.");
  try {
    const { duplicate } = await reportContent({ reporterId: user.id, targetUserId: text(formData, "targetUserId"), kind, refId: text(formData, "refId") || null, reason: text(formData, "reason"), note: text(formData, "note") });
    return success(duplicate ? "Bu bildirimi zaten aldık; ekibimiz inceliyor." : "Bildiriminiz alındı. Pi Kampüs ekibi en kısa sürede inceleyecek.");
  } catch (error) {
    if (error instanceof SafetyError) return failure(error.message);
    throw error;
  }
}

export async function toggleBlockAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser();
  if (!user) return failure("Oturumunuz kapanmış.");
  const targetUserId = text(formData, "targetUserId");
  const block = text(formData, "block") === "1";
  try {
    if (block) await blockUser(user.id, targetUserId);
    else await unblockUser(user.id, targetUserId);
  } catch (error) {
    if (error instanceof SafetyError) return failure(error.message);
    throw error;
  }
  refresh();
  return success(block ? "Engellendi. Bu kişi size artık mesaj ve ders talebi gönderemez." : "Engel kaldırıldı.");
}

/** Yönetim: bildirimi kapatır (gerekirse kişi ayrıca askıya alınır) */
export async function resolveReportAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Yetkiniz yok.");
  await db.contentReport.update({ where: { id: text(formData, "id") }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  refresh();
  return success("Bildirim kapatıldı.");
}

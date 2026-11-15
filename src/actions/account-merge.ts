"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { mergeStudentAccounts, findAccount, MergeError } from "@/server/account-merge";
import { audit } from "@/server/audit";
import { actionUser } from "@/server/auth/current-user";

/** Yönetim: bu sayfadaki (fazla) hesabı, yazılan e-posta/kullanıcı adının hesabına katar. */
export async function mergeAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Yetkiniz yok.");
  const sourceId = String(formData.get("sourceId") ?? "");
  const target = await findAccount(String(formData.get("target") ?? ""));
  if (!target) return failure("Bu e-posta ya da kullanıcı adıyla hesap bulunamadı.", { target: "Hesap bulunamadı." });
  try {
    const { moved } = await mergeStudentAccounts(sourceId, target.id);
    await audit({ actorId: admin.id, action: "user.merge", entityType: "User", entityId: sourceId, details: { into: target.id, moved } });
    refresh();
    return success(`Birleştirildi: ${moved} kurum/Pi Koç bağlantısı ${target.firstName} ${target.lastName} hesabına taşındı, bu hesap kapatıldı.`);
  } catch (error) {
    if (error instanceof MergeError) return failure(error.message);
    throw error;
  }
}

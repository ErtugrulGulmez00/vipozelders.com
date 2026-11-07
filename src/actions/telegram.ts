"use server";

import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { sendTelegram } from "@/server/telegram";

/** Yönetici: Telegram bağlantısını denemek için tek mesaj gönderir. */
export async function sendTelegramTestAction(_: ActionState): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  const result = await sendTelegram("Pi Kampüs Telegram bağlantı denemesi ✅ Bu mesajı aldıysanız yönetici bildirimleri buraya da gelecek.");
  return result.ok ? success("Deneme mesajı gönderildi; Telegram'ı kontrol edin.") : failure(`Gönderilemedi: ${result.error}`);
}

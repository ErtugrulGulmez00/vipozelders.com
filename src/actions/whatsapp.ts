"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

/** Kullanıcı WhatsApp bildirimlerini açar/kapatır (veli, öğretmen). */
export async function setWhatsappOptOutAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT", "TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const on = formData.get("whatsapp") === "on";
  await db.user.update({ where: { id: user.id }, data: { whatsappOptOut: !on } });
  refresh();
  return success(on ? "Önemli bildirimler WhatsApp ile de gelecek." : "WhatsApp bildirimleri kapatıldı; bildirimler site ve e-postayla gelmeye devam eder.");
}

/** Yönetici: WhatsApp bağlantısını denemek için tek mesaj gönderir. */
export async function sendWhatsAppTestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  const { sendWhatsAppText } = await import("@/server/whatsapp");
  const result = await sendWhatsAppText(String(formData.get("phone") ?? ""), "Pi Kampüs WhatsApp bağlantı denemesi ✅ Bu mesajı aldıysanız bildirimler çalışıyor.");
  return result.ok ? success("Mesaj gönderildi; telefonunuzu kontrol edin.") : failure(`Gönderilemedi: ${result.error}`);
}

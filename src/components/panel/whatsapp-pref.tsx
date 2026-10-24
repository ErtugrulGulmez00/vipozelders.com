"use client";

import { setWhatsappOptOutAction } from "@/actions/whatsapp";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/form";

/** Hesap ayarlarında WhatsApp bildirimi tercihi. */
export function WhatsAppPreference({ on, phone }: { on: boolean; phone: string | null }) {
  return (
    <ActionForm action={setWhatsappOptOutAction} className="space-y-3">
      <Checkbox name="whatsapp" defaultChecked={on} label="Önemli bildirimleri WhatsApp ile de almak istiyorum (ders talebi ve onayı, 1 saat kala hatırlatma, çözüm geldi, saat değişikliği)" />
      <p className="text-xs text-slate-500">{phone ? `Mesajlar ${phone} numarasına gider. Numaranızı yukarıdaki bilgilerden değiştirebilirsiniz.` : "WhatsApp bildirimi için hesabınıza telefon numarası ekleyin."}</p>
      <SubmitButton size="sm" variant="outline" pendingText="Kaydediliyor…">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

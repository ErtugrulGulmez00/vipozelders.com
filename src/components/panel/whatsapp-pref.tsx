"use client";

import { setWhatsappOptOutAction } from "@/actions/whatsapp";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { WhatsAppCheckbox } from "@/components/notification-channel";

const LABEL = "Önemli bildirimleri WhatsApp ile de almak istiyorum (ders talebi ve onayı, 1 saat kala hatırlatma, çözüm geldi, saat değişikliği)";

/** Hesap ayarlarında WhatsApp bildirimi tercihi. WhatsApp henüz açık değilse (bildirim kanalı e-posta) devre dışı görünür. */
export function WhatsAppPreference({ on, phone, active }: { on: boolean; phone: string | null; active: boolean }) {
  if (!active) {
    return (
      <div className="space-y-2">
        <WhatsAppCheckbox name="whatsapp" defaultChecked={on} label={LABEL} active={false} />
        <p className="text-xs text-slate-500">WhatsApp bildirimleri onay aşamasında. Şimdilik tüm bildirimler e-posta adresinize ve site/uygulama bildirimi olarak gelir.</p>
      </div>
    );
  }
  return (
    <ActionForm action={setWhatsappOptOutAction} className="space-y-3">
      <WhatsAppCheckbox name="whatsapp" defaultChecked={on} label={LABEL} active />
      <p className="text-xs text-slate-500">{phone ? `Mesajlar ${phone} numarasına gider. Numaranızı yukarıdaki bilgilerden değiştirebilirsiniz.` : "WhatsApp bildirimi için hesabınıza telefon numarası ekleyin."}</p>
      <SubmitButton size="sm" variant="outline" pendingText="Kaydediliyor…">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

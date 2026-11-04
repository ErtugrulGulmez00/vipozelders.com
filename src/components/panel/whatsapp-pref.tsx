"use client";

import { setWhatsappOptOutAction } from "@/actions/whatsapp";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { WhatsAppCheckbox } from "@/components/notification-channel";

const LABEL = "Önemli bildirimleri WhatsApp ile de almak istiyorum (ders talebi ve onayı, 1 saat kala hatırlatma, çözüm geldi, saat değişikliği). Reklam gönderilmez; istediğim zaman kapatabilirim.";

/** Hesap ayarlarında WhatsApp izni. Bildirim kanalı henüz e-posta olsa da izin verilebilir; WhatsApp açılınca geçerli olur. */
export function WhatsAppPreference({ on, phone, active }: { on: boolean; phone: string | null; active: boolean }) {
  return (
    <ActionForm action={setWhatsappOptOutAction} className="space-y-3">
      <WhatsAppCheckbox name="whatsapp" defaultChecked={on} label={LABEL} active />
      <p className="text-xs text-slate-500">
        {phone ? `Mesajlar ${phone} numarasına gider. Numaranızı yukarıdaki bilgilerden değiştirebilirsiniz.` : "WhatsApp bildirimi için hesabınıza telefon numarası ekleyin."}
        {active ? " WhatsApp’tan DUR yazarak da durdurabilirsiniz." : " WhatsApp bildirimleri henüz başlamadı; izin verirseniz başladığında gönderilir. Şimdilik bildirimler e-posta ve site/uygulama bildirimi olarak gelir."}
      </p>
      <SubmitButton size="sm" variant="outline" pendingText="Kaydediliyor…">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

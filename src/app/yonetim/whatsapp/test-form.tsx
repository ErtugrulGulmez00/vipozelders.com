"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import { sendWhatsAppTestAction } from "@/actions/whatsapp";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

export function WhatsAppTestForm() {
  return (
    <ActionForm action={sendWhatsAppTestAction} className="flex flex-wrap items-end gap-2">
      <Field label="Deneme mesajı gönder" className="min-w-56 flex-1" hint="Kendi numaranızı yazın; bağlantı çalışıyorsa birkaç saniyede gelir.">
        <PhoneInput name="phone" required placeholder="05XX XXX XX XX" />
      </Field>
      <SubmitButton pendingText="Gönderiliyor…">Gönder</SubmitButton>
    </ActionForm>
  );
}

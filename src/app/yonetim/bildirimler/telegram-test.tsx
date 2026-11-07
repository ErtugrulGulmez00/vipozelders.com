"use client";

import { sendTelegramTestAction } from "@/actions/telegram";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function TelegramTestForm() {
  return (
    <ActionForm action={sendTelegramTestAction}>
      <SubmitButton size="sm" variant="outline" pendingText="Gönderiliyor…">
        Deneme mesajı gönder
      </SubmitButton>
    </ActionForm>
  );
}

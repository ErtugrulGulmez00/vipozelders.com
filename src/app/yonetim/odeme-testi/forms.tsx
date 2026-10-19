"use client";

import { refundGarantiTestAction, startGarantiTestAction } from "@/actions/payment-test";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function StartTestForm({ mode, label, disabled }: { mode: "TEST" | "PROD"; label: string; disabled?: boolean }) {
  return (
    <ActionForm action={startGarantiTestAction}>
      <input type="hidden" name="mode" value={mode} />
      <SubmitButton
        variant={mode === "PROD" ? "primary" : "secondary"}
        disabled={disabled}
        pendingText="Hazırlanıyor…"
        confirmMessage={mode === "PROD" ? "Gerçek kartınızdan 1,00 TL çekilecek (sonra buradan iade edebilirsiniz). Devam edilsin mi?" : undefined}
      >
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

export function RefundTestForm({ id }: { id: string }) {
  return (
    <ActionForm action={refundGarantiTestAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="outline" pendingText="İade ediliyor…">
        İade et
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import { confirmTwoFactorSetupAction, disableTwoFactorAction } from "@/actions/security";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

function CodeInput() {
  return (
    <Input
      id="code"
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]{6,7}"
      maxLength={7}
      placeholder="123 456"
      className="w-40 text-center tracking-[0.3em]"
      required
    />
  );
}

export function ConfirmTwoFactorForm() {
  return (
    <ActionForm action={confirmTwoFactorSetupAction} className="flex flex-wrap items-end gap-3">
      <Field label="Uygulamadaki kod" htmlFor="code">
        <CodeInput />
        <FieldError name="code" />
      </Field>
      <SubmitButton pendingText="Doğrulanıyor…">Onayla ve aç</SubmitButton>
    </ActionForm>
  );
}

export function DisableTwoFactorForm() {
  return (
    <ActionForm action={disableTwoFactorAction} className="flex flex-wrap items-end gap-3">
      <Field label="Uygulamadaki kod" htmlFor="code">
        <CodeInput />
        <FieldError name="code" />
      </Field>
      <SubmitButton variant="danger" pendingText="Kapatılıyor…">
        İki adımlı doğrulamayı kapat
      </SubmitButton>
    </ActionForm>
  );
}

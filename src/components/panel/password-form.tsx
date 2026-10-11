"use client";

import { changePasswordAction } from "@/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-3">
      <Field label="Mevcut şifre" htmlFor="pw-current">
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <FieldError name="current" />
      <Field label="Yeni şifre" htmlFor="pw-new" hint="En az 8 karakter, en az bir harf ve bir rakam.">
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <FieldError name="password" />
      <Field label="Yeni şifre (tekrar)" htmlFor="pw-confirm">
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FieldError name="confirm" />
      <SubmitButton variant="outline">Şifreyi değiştir</SubmitButton>
    </ActionForm>
  );
}

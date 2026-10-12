"use client";

import { verifyTwoFactorAction } from "@/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

export function TwoFactorForm({ next }: { next: string }) {
  return (
    <ActionForm action={verifyTwoFactorAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Doğrulama kodu" htmlFor="code">
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          placeholder="123 456"
          className="text-center text-lg tracking-[0.3em]"
          required
          autoFocus
        />
        <FieldError name="code" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Doğrulanıyor…">
        Doğrula ve giriş yap
      </SubmitButton>
    </ActionForm>
  );
}

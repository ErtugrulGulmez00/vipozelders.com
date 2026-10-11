"use client";

import { savePayoutAction } from "@/actions/teacher";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

export function PayoutForm({ teacherId, legalName, iban, maskedIdentity }: { teacherId: string; legalName: string; iban: string; maskedIdentity: string | null }) {
  return (
    <ActionForm action={savePayoutAction} className="space-y-4">
      <input type="hidden" name="teacherId" value={teacherId} />
      <Field label="Hesap sahibinin adı soyadı" htmlFor="legalName">
        <Input id="legalName" name="legalName" defaultValue={legalName} required />
      </Field>
      <FieldError name="legalName" />
      <Field label="IBAN" htmlFor="iban" hint="Hesap sizin adınıza olmalı.">
        <Input id="iban" name="iban" defaultValue={iban} placeholder="TR00 0000 0000 0000 0000 0000 00" required />
      </Field>
      <FieldError name="iban" />
      <Field
        label="T.C. kimlik numarası"
        htmlFor="identityNumber"
        hint={maskedIdentity ? `Kayıtlı: ${maskedIdentity}. Değiştirmek için yeni numarayı yazın.` : "Ödeme kuruluşu kaydı ve fatura için gereklidir; şifreli saklanır."}
      >
        <Input id="identityNumber" name="identityNumber" inputMode="numeric" maxLength={11} autoComplete="off" />
      </Field>
      <FieldError name="identityNumber" />
      <SubmitButton>Ödeme bilgilerini kaydet</SubmitButton>
    </ActionForm>
  );
}

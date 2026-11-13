"use client";

import { generatePromoCodesAction, redeemPromoAction, revokePromoCodeAction } from "@/actions/koc-promo";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { DateInput } from "@/components/ui/date-input";
import { Field, Input } from "@/components/ui/form";

/** Koç: deneme kodunu girer. */
export function RedeemPromoForm() {
  return (
    <ActionForm action={redeemPromoAction} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <Field label="Deneme kodu" className="min-w-56 flex-1">
        <Input name="code" placeholder="PIKOC-XXXX-XXXX" autoComplete="off" required className="font-mono uppercase" />
      </Field>
      <SubmitButton>Kodu kullan</SubmitButton>
    </ActionForm>
  );
}

/** Yönetim: tek kullanımlık kod üretir. */
export function GeneratePromoForm() {
  return (
    <ActionForm action={generatePromoCodesAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kaç kod">
          <Input name="count" type="number" min={1} max={50} defaultValue={1} />
        </Field>
        <Field label="Deneme süresi (gün)">
          <Input name="days" type="number" min={1} max={90} defaultValue={30} />
        </Field>
        <Field label="Kime / not" className="sm:col-span-2">
          <Input name="note" placeholder="Örn: Ayşe Hoca, test öğretmeni" maxLength={120} />
        </Field>
        <Field label="Son kullanma tarihi (isteğe bağlı)" hint="Bu tarihten sonra kod girilemez." className="sm:col-span-2">
          <DateInput name="expiresAt" />
        </Field>
      </div>
      <SubmitButton>Kod üret</SubmitButton>
    </ActionForm>
  );
}

export function RevokePromoForm({ codeId, redeemed }: { codeId: string; redeemed: boolean }) {
  return (
    <ActionForm action={revokePromoCodeAction}>
      <input type="hidden" name="codeId" value={codeId} />
      <SubmitButton size="sm" variant="outline" confirmMessage={redeemed ? "Kod iptal edilsin mi? Kullanan hesabın denemesi hemen biter." : "Kod iptal edilsin mi?"}>
        İptal et
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import { generatePackageCodesAction, generatePromoCodesAction, redeemPromoAction, revokePromoCodeAction } from "@/actions/koc-promo";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { DateInput } from "@/components/ui/date-input";
import { Field, Input, Select } from "@/components/ui/form";

/** Koç: deneme ya da paket kodunu girer. */
export function RedeemPromoForm({ label = "Deneme kodu" }: { label?: string }) {
  return (
    <ActionForm action={redeemPromoAction} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <Field label={label} className="min-w-56 flex-1">
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

/** Yönetim: satılan paket için kod üretir (kademe + ay; tutar kademe fiyatından). */
export function GeneratePackageForm({ tiers }: { tiers: { students: number; name: string; priceTl: number }[] }) {
  return (
    <ActionForm action={generatePackageCodesAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Paket" className="sm:col-span-2">
          <Select name="students" defaultValue={tiers[1]?.students ?? tiers[0]?.students}>
            {tiers.map((t) => (
              <option key={t.students} value={t.students}>
                {t.name} · {t.students} öğrenci · aylık {t.priceTl.toLocaleString("tr-TR")} ₺
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kaç ay">
          <Input name="months" type="number" min={1} max={12} defaultValue={1} />
        </Field>
        <Field label="Kaç kod">
          <Input name="count" type="number" min={1} max={50} defaultValue={1} />
        </Field>
        <Field label="Kime / not" hint="Örn: Ayşe Hoca, 16.11 havale" className="sm:col-span-2">
          <Input name="note" maxLength={120} />
        </Field>
        <Field label="Son kullanma tarihi (isteğe bağlı)" className="sm:col-span-2">
          <DateInput name="expiresAt" />
        </Field>
      </div>
      <SubmitButton>Paket kodu üret</SubmitButton>
    </ActionForm>
  );
}

export function RevokePromoForm({ codeId, redeemed }: { codeId: string; redeemed: boolean }) {
  return (
    <ActionForm action={revokePromoCodeAction}>
      <input type="hidden" name="codeId" value={codeId} />
      <SubmitButton size="sm" variant="outline" confirmMessage={redeemed ? "Kod iptal edilsin mi? Deneme koduysa kullanan hesabın denemesi hemen biter; paket kodunun ödemesi kayıtlı kalır." : "Kod iptal edilsin mi?"}>
        İptal et
      </SubmitButton>
    </ActionForm>
  );
}

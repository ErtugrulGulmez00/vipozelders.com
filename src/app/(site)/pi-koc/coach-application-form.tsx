"use client";

import { PhoneInput } from "@/components/ui/phone-input";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { applyCenterAction } from "@/actions/center-public";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

/** Pi Koç başvurusu: kurum başvurusuyla aynı kuyruğa düşer. Öğrenci sayısı, tıklanan fiyat kartından (?ogrenci=…) seçili gelir. */
export function CoachApplicationForm({ tiers }: { tiers: number[] }) {
  const params = useSearchParams();
  const chosen = params.get("ogrenci") ?? "";
  const students = tiers.map(String).includes(chosen) ? chosen : "";
  return (
    <ActionForm action={applyCenterAction} resetOnSuccess className="space-y-4">
      <input type="hidden" name="kind" value="COACH" />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Panelde görünecek ad" htmlFor="k-name" hint="Adınız ya da koçluk markanız.">
        <Input id="k-name" name="centerName" required />
        <FieldError name="centerName" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Adınız soyadınız" htmlFor="k-contact">
          <Input id="k-contact" name="contactName" autoComplete="name" required />
          <FieldError name="contactName" />
        </Field>
        <Field label="Cep telefonu" htmlFor="k-phone">
          <PhoneInput id="k-phone" name="phone" autoComplete="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
      </div>
      <Field label="E-posta" htmlFor="k-email" hint="Pi Kampüs öğretmen hesabınız varsa aynı e-postayı yazın; panel o hesaba bağlanır.">
        <Input id="k-email" name="email" type="email" autoComplete="email" required />
        <FieldError name="email" />
      </Field>
      <Field label="Öğrenci sayısı" htmlFor="k-count">
        <Select key={`s-${students}`} id="k-count" name="studentCount" defaultValue={students}>
          <option value="">Seçin</option>
          {tiers.map((n) => (
            <option key={n} value={n}>
              {n} öğrenciye kadar
            </option>
          ))}
        </Select>
      </Field>
      <details className="rounded-xl border border-slate-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">Not eklemek isterseniz</summary>
        <Textarea name="message" rows={3} maxLength={2000} aria-label="Notunuz" placeholder="Hangi sınavlara koçluk yapıyorsunuz, şu an ne kullanıyorsunuz?" className="mt-2" />
      </details>
      <div>
        <Checkbox
          name="kvkk"
          required
          label={
            <>
              Başvurum için kişisel verilerimin işlenmesine ilişkin{" "}
              <Link href="/sayfa/kvkk-aydinlatma-metni" target="_blank" className="font-medium text-brand-700 underline">
                KVKK Aydınlatma Metni
              </Link>
              ’ni ve{" "}
              <Link href="/sayfa/kurum-hizmet-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
                Hizmet Sözleşmesi
              </Link>
              ’ni okudum.
            </>
          }
        />
        <FieldError name="kvkk" />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Gönderiliyor…">
        Başvuruyu gönder
      </SubmitButton>
    </ActionForm>
  );
}

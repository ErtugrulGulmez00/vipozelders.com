"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { applyCenterAction } from "@/actions/center-public";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CENTER_EDITION_LABEL } from "@/lib/center/labels";

const STUDENT_OPTIONS = ["20’ye kadar", "21-100", "101-200", "200’den fazla"];

/** Kısa başvuru formu. Paket ve öğrenci sayısı, tıklanan paket/fiyat kartından (?paket=…&ogrenci=…) seçili gelir. */
export function CenterApplicationForm() {
  const params = useSearchParams();
  const paket = params.get("paket");
  const edition = paket === "ETUT" || paket === "DERSHANE" ? paket : "";
  const ogrenci = params.get("ogrenci");
  const students = ogrenci && STUDENT_OPTIONS.includes(ogrenci) ? ogrenci : "";
  return (
    <ActionForm action={applyCenterAction} resetOnSuccess className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Kurum adı" htmlFor="c-name">
        <Input id="c-name" name="centerName" required />
        <FieldError name="centerName" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Yetkili adı soyadı" htmlFor="c-contact">
          <Input id="c-contact" name="contactName" autoComplete="name" required />
          <FieldError name="contactName" />
        </Field>
        <Field label="Cep telefonu" htmlFor="c-phone">
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
      </div>
      <Field label="E-posta" htmlFor="c-email" hint="Panel giriş bilgileriniz bu adrese gelir.">
        <Input id="c-email" name="email" type="email" autoComplete="email" required />
        <FieldError name="email" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="İlgilendiğiniz paket" htmlFor="c-edition">
          <Select key={`e-${edition}`} id="c-edition" name="edition" defaultValue={edition}>
            <option value="">Henüz bilmiyorum</option>
            {Object.entries(CENTER_EDITION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğrenci sayısı" htmlFor="c-count">
          <Select key={`s-${students}`} id="c-count" name="studentCount" defaultValue={students}>
            <option value="">Seçin</option>
            {STUDENT_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </Field>
      </div>
      <details className="rounded-xl border border-slate-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">Not eklemek isterseniz</summary>
        <Textarea id="c-message" name="message" rows={3} maxLength={2000} aria-label="Notunuz" placeholder="Şu an ne kullanıyorsunuz, en çok neye ihtiyacınız var?" className="mt-2" />
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

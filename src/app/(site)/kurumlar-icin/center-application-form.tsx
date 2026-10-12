"use client";

import Link from "next/link";
import { applyCenterAction } from "@/actions/center-public";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CENTER_KIND_LABEL } from "@/lib/center/labels";

export function CenterApplicationForm({ cities }: { cities: { id: number; name: string }[] }) {
  return (
    <ActionForm action={applyCenterAction} resetOnSuccess className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Kurum adı" htmlFor="c-name">
        <Input id="c-name" name="centerName" required />
        <FieldError name="centerName" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kurum türü" htmlFor="c-kind">
          <Select id="c-kind" name="kind" defaultValue="ETUT">
            {Object.entries(CENTER_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğrenci sayısı" htmlFor="c-count">
          <Select id="c-count" name="studentCount" defaultValue="">
            <option value="">Seçin</option>
            <option>50’den az</option>
            <option>50-100</option>
            <option>100-300</option>
            <option>300’den fazla</option>
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Yetkili adı soyadı" htmlFor="c-contact">
          <Input id="c-contact" name="contactName" autoComplete="name" required />
          <FieldError name="contactName" />
        </Field>
        <Field label="İl" htmlFor="c-city">
          <Select id="c-city" name="cityId" defaultValue="">
            <option value="">Seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cep telefonu" htmlFor="c-phone">
          <Input id="c-phone" name="phone" type="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
        <Field label="E-posta" htmlFor="c-email">
          <Input id="c-email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </Field>
      </div>
      <Field label="Notunuz (isteğe bağlı)" htmlFor="c-message">
        <Textarea id="c-message" name="message" rows={3} maxLength={2000} placeholder="Şu an ne kullanıyorsunuz, en çok neye ihtiyacınız var?" />
      </Field>
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
        Ücretsiz denemeyi başlat
      </SubmitButton>
    </ActionForm>
  );
}

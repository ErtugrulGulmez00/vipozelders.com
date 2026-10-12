"use client";

import Link from "next/link";
import { applyTeacherAction } from "@/actions/applications";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

export function ApplicationForm({ cities }: { cities: { id: number; name: string }[] }) {
  return (
    <ActionForm action={applyTeacherAction} resetOnSuccess className="space-y-4">
      {/* Botlar için tuzak alan: kullanıcılar görmez. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" htmlFor="a-firstName">
          <Input id="a-firstName" name="firstName" autoComplete="given-name" required />
          <FieldError name="firstName" />
        </Field>
        <Field label="Soyad" htmlFor="a-lastName">
          <Input id="a-lastName" name="lastName" autoComplete="family-name" required />
          <FieldError name="lastName" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-posta" htmlFor="a-email">
          <Input id="a-email" name="email" type="email" autoComplete="email" required />
          <FieldError name="email" />
        </Field>
        <Field label="Cep telefonu" htmlFor="a-phone">
          <Input id="a-phone" name="phone" type="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bulunduğunuz il" htmlFor="a-city">
          <Select id="a-city" name="cityId" defaultValue="">
            <option value="">Seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğretmenlik deneyimi (yıl)" htmlFor="a-exp">
          <Input id="a-exp" name="experienceYears" type="number" min={0} max={60} defaultValue={0} />
        </Field>
      </div>
      <Field label="Ders verdiğiniz kademe ve dersler" htmlFor="a-subjects" hint="Örn: Lise matematik, LGS fen bilimleri, YKS koçluk">
        <Input id="a-subjects" name="subjects" required maxLength={300} />
        <FieldError name="subjects" />
      </Field>
      <Field label="Eğitim (isteğe bağlı)" htmlFor="a-education" hint="Örn: Boğaziçi Üniversitesi · Matematik Öğretmenliği">
        <Input id="a-education" name="education" maxLength={200} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Ders şekli</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Checkbox name="offersOnline" defaultChecked label="Online (sitedeki sanal sınıf)" />
          <Checkbox name="offersInPerson" label="Yüz yüze" />
        </div>
      </fieldset>
      <Field label="Kendinizi kısaca tanıtın (isteğe bağlı)" htmlFor="a-message">
        <Textarea id="a-message" name="message" rows={4} maxLength={2000} placeholder="Hangi öğrencilerle çalıştınız, nasıl bir yöntem izliyorsunuz?" />
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
        Başvurumu gönder
      </SubmitButton>
    </ActionForm>
  );
}

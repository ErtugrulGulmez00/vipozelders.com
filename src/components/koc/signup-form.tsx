"use client";

import Link from "next/link";
import { kocAddToAccountAction, kocSignupAction } from "@/actions/koc-signup";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";

type Tier = { students: number; label: string };

function Consent() {
  return (
    <div>
      <Checkbox
        name="kvkk"
        required
        label={
          <>
            <Link href="/sayfa/kvkk-aydinlatma-metni" target="_blank" className="font-medium text-brand-700 underline">
              KVKK Aydınlatma Metni
            </Link>
            ’ni ve{" "}
            <Link href="/sayfa/kurum-hizmet-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
              Hizmet Sözleşmesi
            </Link>
            ’ni okudum, kabul ediyorum.
          </>
        }
      />
      <FieldError name="kvkk" />
    </div>
  );
}

function TierSelect({ tiers, chosen, freeStudents }: { tiers: Tier[]; chosen: number | null; freeStudents: number }) {
  return (
    <Field
      label="Hangi paketle başlamak istersiniz?"
      htmlFor="ks-students"
      hint={freeStudents > 0 ? "Hesabınız ücretsiz paketle açılır. Ücretli paket seçerseniz ödemeniz kaydedilince açılır; ödeme bilgisi panelde." : "Ücretli paket ödemeniz kaydedilince açılır; ödeme bilgisi panelde."}
    >
      <Select id="ks-students" name="students" defaultValue={String(chosen ?? (freeStudents > 0 ? 0 : (tiers[0]?.students ?? "")))}>
        {freeStudents > 0 ? <option value={0}>Karalama Defteri · ücretsiz, {freeStudents} öğrenciye kadar</option> : null}
        {tiers.map((t) => (
          <option key={t.students} value={t.students}>
            {t.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Yeni hesapla Pi Koç kaydı. */
export function KocSignupForm({ tiers, chosen, freeStudents }: { tiers: Tier[]; chosen: number | null; freeStudents: number }) {
  return (
    <ActionForm action={kocSignupAction} className="space-y-4">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" htmlFor="ks-first">
          <Input id="ks-first" name="firstName" autoComplete="given-name" required maxLength={50} />
          <FieldError name="firstName" />
        </Field>
        <Field label="Soyad" htmlFor="ks-last">
          <Input id="ks-last" name="lastName" autoComplete="family-name" required maxLength={50} />
          <FieldError name="lastName" />
        </Field>
      </div>
      <Field label="E-posta" htmlFor="ks-email" hint="Giriş ve veli raporları için.">
        <Input id="ks-email" name="email" type="email" autoComplete="email" required maxLength={120} />
        <FieldError name="email" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cep telefonu" htmlFor="ks-phone">
          <PhoneInput id="ks-phone" name="phone" autoComplete="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
        <Field label="Şifre" htmlFor="ks-password" hint="En az 8 karakter, harf ve rakam.">
          <Input id="ks-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <FieldError name="password" />
        </Field>
      </div>
      <Field label="Panelde görünecek ad (isteğe bağlı)" htmlFor="ks-panel" hint="Boş bırakırsanız “Ad Soyad Koçluk”.">
        <Input id="ks-panel" name="panelName" maxLength={120} placeholder="Örn. Ayşe Yılmaz Koçluk" />
      </Field>
      <TierSelect tiers={tiers} chosen={chosen} freeStudents={freeStudents} />
      <Consent />
      <SubmitButton size="lg" className="w-full" pendingText="Hesabınız açılıyor…">
        Ücretsiz başla
      </SubmitButton>
    </ActionForm>
  );
}

/** Giriş yapmış kişi: tek tıkla hesabına Pi Koç ekler. */
export function KocAddToAccountForm({ tiers, chosen, name, freeStudents }: { tiers: Tier[]; chosen: number | null; name: string; freeStudents: number }) {
  return (
    <ActionForm action={kocAddToAccountAction} className="space-y-4">
      <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-800">
        <b>{name}</b> hesabınıza Pi Koç eklenecek; aynı e-posta ve şifreyle “Pi Koç girişi”nden girersiniz.
      </p>
      <Field label="Panelde görünecek ad (isteğe bağlı)" htmlFor="ka-panel">
        <Input id="ka-panel" name="panelName" maxLength={120} placeholder={`${name} Koçluk`} />
      </Field>
      <TierSelect tiers={tiers} chosen={chosen} freeStudents={freeStudents} />
      <Consent />
      <SubmitButton size="lg" className="w-full" pendingText="Hazırlanıyor…">
        Ücretsiz başla
      </SubmitButton>
    </ActionForm>
  );
}

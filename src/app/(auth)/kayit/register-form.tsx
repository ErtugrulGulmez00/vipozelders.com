"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { registerAction } from "@/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Label } from "@/components/ui/form";

export function RegisterForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const invite = params.get("davet") ?? "";
  return (
    <ActionForm action={registerAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="davet" value={invite} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Hesabı kim kullanacak?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "PARENT", title: "Veliyim", text: "Çocuğum için ders alacağım" },
            { value: "STUDENT", title: "Öğrenciyim", text: "18 yaşından büyüğüm" },
          ].map((option, index) => (
            <label key={option.value} className="cursor-pointer rounded-xl border border-slate-300 p-3 has-checked:border-brand-500 has-checked:bg-brand-50">
              <input type="radio" name="accountType" value={option.value} defaultChecked={index === 0} className="sr-only" />
              <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
              <span className="block text-xs text-slate-500">{option.text}</span>
            </label>
          ))}
        </div>
        <FieldError name="accountType" />
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">Ad</Label>
          <Input id="firstName" name="firstName" autoComplete="given-name" required />
          <FieldError name="firstName" />
        </div>
        <div>
          <Label htmlFor="lastName">Soyad</Label>
          <Input id="lastName" name="lastName" autoComplete="family-name" required />
          <FieldError name="lastName" />
        </div>
      </div>
      <div>
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        <FieldError name="email" />
      </div>
      <Field label="Cep telefonu (isteğe bağlı)" htmlFor="phone" hint="Ders hatırlatmaları için kullanılır.">
        <Input id="phone" name="phone" type="tel" placeholder="05XX XXX XX XX" autoComplete="tel" />
      </Field>
      <FieldError name="phone" />
      <Field label="Şifre" htmlFor="password" hint="En az 8 karakter, en az bir harf ve bir rakam.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <FieldError name="password" />
      <div className="space-y-2.5 rounded-xl bg-slate-50 p-3">
        <Checkbox
          name="kvkk"
          required
          label={
            <>
              <Link href="/sayfa/kvkk-aydinlatma-metni" target="_blank" className="font-medium text-brand-700 underline">
                KVKK Aydınlatma Metni
              </Link>
              ’ni okudum; kişisel verilerimin işlenmesini anladım.
            </>
          }
        />
        <FieldError name="kvkk" />
        <Checkbox
          name="terms"
          required
          label={
            <>
              <Link href="/sayfa/kullanim-sartlari" target="_blank" className="font-medium text-brand-700 underline">
                Kullanım Şartları
              </Link>
              ’nı kabul ediyorum.
            </>
          }
        />
        <FieldError name="terms" />
        <Checkbox name="marketing" label="Kampanya ve yeniliklerden e-posta ile haberdar olmak istiyorum (isteğe bağlı)." />
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Hesap oluşturuluyor…">
        Hesabımı oluştur
      </SubmitButton>
    </ActionForm>
  );
}

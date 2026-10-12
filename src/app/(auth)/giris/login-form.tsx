"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

/** defaultNext: girişten sonra gidilecek sayfa (ör. kurum girişinde /kurum); adresteki ?next= önceliklidir. */
export function LoginForm({ defaultNext = "" }: { defaultNext?: string }) {
  const next = useSearchParams().get("next") ?? defaultNext;
  return (
    <ActionForm action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-posta veya kullanıcı adı" htmlFor="identifier">
        <Input id="identifier" name="identifier" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Şifre" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex justify-end">
        <Link href="/sifremi-unuttum" className="text-sm font-medium text-brand-700 hover:underline">
          Şifremi unuttum
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Giriş yapılıyor…">
        Giriş yap
      </SubmitButton>
    </ActionForm>
  );
}

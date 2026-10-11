import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Şifremi unuttum" };

export default function ForgotPasswordPage() {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Şifremi unuttum</h1>
      <p className="mt-1 text-sm text-slate-500">
        Kayıtlı e-posta adresinizi yazın, size şifre sıfırlama bağlantısı gönderelim. Öğretmenseniz ve e-postanız tanımlı değilse site yöneticisinden yeni geçici şifre isteyin.
      </p>
      <ActionForm action={forgotPasswordAction} className="mt-6 space-y-4">
        <Field label="E-posta" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton className="w-full" size="lg" pendingText="Gönderiliyor…">
          Bağlantı gönder
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/giris" className="font-semibold text-brand-700 hover:underline">
          Girişe dön
        </Link>
      </p>
    </Card>
  );
}

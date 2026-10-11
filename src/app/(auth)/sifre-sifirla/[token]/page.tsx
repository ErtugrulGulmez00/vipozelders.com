import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { resetPasswordAction } from "@/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert, Card, Skeleton } from "@/components/ui/primitives";
import { peekUserToken } from "@/server/auth/tokens";

export const metadata: Metadata = { title: "Yeni şifre belirle" };

export default function ResetPasswordPage({ params }: PageProps<"/sifre-sifirla/[token]">) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Yeni şifre belirleyin</h1>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-48" />}>
          <ResetForm params={params} />
        </Suspense>
      </div>
    </Card>
  );
}

async function ResetForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await peekUserToken(token, "PASSWORD_RESET"))) {
    return (
      <div className="space-y-4">
        <Alert tone="warning">Bu bağlantının süresi dolmuş veya daha önce kullanılmış.</Alert>
        <Link href="/sifremi-unuttum" className={buttonClasses("outline", "md", "w-full")}>
          Yeni bağlantı iste
        </Link>
      </div>
    );
  }
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Yeni şifre" htmlFor="password" hint="En az 8 karakter, en az bir harf ve bir rakam.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <FieldError name="password" />
      <Field label="Yeni şifre (tekrar)" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FieldError name="confirm" />
      <SubmitButton className="w-full" size="lg">
        Şifremi kaydet
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/giris" className="font-semibold text-brand-700 hover:underline">
          Giriş sayfasına git
        </Link>
      </p>
    </ActionForm>
  );
}

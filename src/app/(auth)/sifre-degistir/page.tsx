import type { Metadata } from "next";
import { changePasswordAction } from "@/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { requireUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Şifre değiştir" };
export const instant = false;

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPendingPasswordChange: true });
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">{user.mustChangePassword ? "Kendi şifrenizi belirleyin" : "Şifre değiştir"}</h1>
      {user.mustChangePassword ? (
        <Alert tone="info" className="mt-4">
          Merhaba {user.firstName}! Size verilen geçici şifreyle giriş yaptınız. Hesabınızın güvenliği için devam etmeden önce yalnızca sizin bileceğiniz bir şifre belirleyin.
        </Alert>
      ) : null}
      <ActionForm action={changePasswordAction} className="mt-6 space-y-4">
        <Field label={user.mustChangePassword ? "Geçici şifre" : "Mevcut şifre"} htmlFor="current">
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
        <FieldError name="current" />
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
      </ActionForm>
    </Card>
  );
}

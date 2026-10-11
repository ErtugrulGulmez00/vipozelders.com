import type { Metadata } from "next";
import { updateTeacherContactAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { PasswordForm } from "@/components/panel/password-form";
import { Field, Input } from "@/components/ui/form";
import { Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Hesap ayarları" };

export default async function TeacherSettingsPage() {
  const user = await requireRole("TEACHER");
  return (
    <>
      <PageHeader title="Hesap ayarları" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Hesap" description="Ad, kullanıcı adı ve e-posta değişiklikleri için yöneticiye başvurun." />
          <CardBody className="space-y-5">
            <DescriptionList
              items={[
                { label: "Ad soyad", value: `${user.firstName} ${user.lastName}` },
                { label: "Kullanıcı adı", value: user.username ?? "—" },
                { label: "E-posta", value: user.email ?? "—" },
              ]}
            />
            <ActionForm action={updateTeacherContactAction} className="space-y-3">
              <Field label="Cep telefonu" htmlFor="phone" hint="Yalnızca onaylı yüz yüze derslerde veliyle paylaşılır.">
                <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="05XX XXX XX XX" />
              </Field>
              <SubmitButton variant="outline">Kaydet</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Şifre değiştir" />
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

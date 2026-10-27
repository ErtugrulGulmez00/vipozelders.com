import type { Metadata } from "next";
import { updateTeacherContactAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { AccountDeletionForm } from "@/components/panel/account-deletion-form";
import { PasswordForm } from "@/components/panel/password-form";
import { WhatsAppPreference } from "@/components/panel/whatsapp-pref";
import { whatsappActive } from "@/lib/notification-channels";
import { loadSettings } from "@/server/settings";
import { Field, Input } from "@/components/ui/form";
import { Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Hesap ayarları" };

export default async function TeacherSettingsPage() {
  const user = await requireRole("TEACHER");
  const [prefs, settings] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: user.id }, select: { whatsappOptOut: true, phone: true } }), loadSettings()]);
  return (
    <>
      <PageHeader title="Hesap ayarları" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
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
          <CardHeader title="WhatsApp bildirimleri" />
          <CardBody>
            <WhatsAppPreference on={!prefs.whatsappOptOut} phone={prefs.phone} active={whatsappActive(settings.notificationChannel)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Şifre değiştir" />
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Hesabı sil" />
          <CardBody>
            <AccountDeletionForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

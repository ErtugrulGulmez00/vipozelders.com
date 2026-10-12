import type { Metadata } from "next";
import { PasswordForm } from "@/components/panel/password-form";
import { Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/primitives";
import { CENTER_ROLE_LABEL } from "@/lib/center/permissions";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "Hesabım" };

export default async function CenterAccountPage() {
  const ctx = await requireCenter();
  const { user } = ctx;
  return (
    <>
      <PageHeader title="Hesabım" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Hesap" description="Ad, e-posta ve rol değişiklikleri için kurum yöneticinize başvurun." />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Ad soyad", value: `${user.firstName} ${user.lastName}` },
                { label: "Kullanıcı adı", value: user.username ?? "—" },
                { label: "E-posta", value: user.email ?? "—" },
                { label: "Telefon", value: user.phone ?? "—" },
                { label: "Kurum", value: ctx.center.name },
                { label: "Rol", value: CENTER_ROLE_LABEL[ctx.member.role] },
              ]}
            />
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

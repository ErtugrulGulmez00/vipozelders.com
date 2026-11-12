import type { Metadata } from "next";
import Link from "next/link";
import { RateBar } from "@/components/center/center-ui";
import { KocSettingsForm } from "@/components/koc/koc-forms";
import { PasswordForm } from "@/components/panel/password-form";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL } from "@/lib/center/labels";
import { formatDate } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { coachPlanLabel } from "@/lib/pi-koc";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Hesap ve abonelik" };

export default async function KocAccountPage() {
  const ctx = await requireCenter();
  const active = await db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } });
  const access = CENTER_ACCESS_LABEL[ctx.access.state];
  return (
    <>
      <PageHeader title="Hesap ve abonelik" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Paketiniz" action={ctx.coach?.state === "free" ? <Badge tone="slate">Ücretsiz</Badge> : <Badge tone={access.tone}>{access.label}</Badge>} />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                { label: "Paket", value: ctx.coach ? coachPlanLabel(ctx.coach) : "—" },
                { label: ctx.coach?.state === "trial" ? "Deneme bitişi" : "Bitiş", value: ctx.coach?.endsAt ? formatDate(ctx.coach.endsAt) : "Süresiz" },
                { label: "Öğrenci", value: `${active} / ${ctx.center.studentLimit}` },
              ]}
            />
            <RateBar value={active / Math.max(ctx.center.studentLimit, 1)} />
            {ctx.can("subscription.view") ? (
              <Link href="/koc/abonelik" className="inline-block text-sm font-semibold text-brand-700 hover:underline">
                Paketler ve ödeme geçmişi
              </Link>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Bilgileriniz" description={`Giriş e-postanız: ${ctx.user.email ?? "—"}`} />
          <CardBody>
            <KocSettingsForm values={{ name: ctx.center.name, phone: ctx.center.phone, email: ctx.center.email }} />
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

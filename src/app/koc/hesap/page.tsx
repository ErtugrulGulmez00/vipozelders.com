import type { Metadata } from "next";
import Link from "next/link";
import { RateBar } from "@/components/center/center-ui";
import { AutoReportForm, KocSettingsForm } from "@/components/koc/koc-forms";
import { LockedFeature } from "@/components/koc/locked-feature";
import { PasswordForm } from "@/components/panel/password-form";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL } from "@/lib/center/labels";
import { formatDate } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { coachFeatureOpen, coachPlanLabel, formatHours } from "@/lib/pi-koc";
import { coachMeetingStatus } from "@/server/koc-meeting-usage";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Hesap ve abonelik" };

export default async function KocAccountPage() {
  const ctx = await requireCenter();
  const [active, meetings, center] = await Promise.all([
    db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } }),
    coachMeetingStatus(ctx.center.id),
    db.center.findUniqueOrThrow({ where: { id: ctx.center.id }, select: { coachAutoReport: true } }),
  ]);
  const autoOpen = coachFeatureOpen(ctx.coach, "autoReport");
  const meetingRatio = meetings.usedMinutes / Math.max(meetings.policy.poolMinutes, 1);
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
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-600">Bu ay görüntülü görüşme</span>
                <span className="font-semibold text-slate-900">
                  {formatHours(meetings.usedMinutes)} / {formatHours(meetings.policy.poolMinutes)}
                </span>
              </div>
              <RateBar value={Math.min(1, meetingRatio)} tone={meetingRatio >= 1 ? "rose" : meetingRatio > 0.8 ? "amber" : "brand"} />
              <p className="mt-1 text-xs text-slate-500">
                {meetings.policy.hard
                  ? `Ücretsiz pakette görüşme başına en fazla ${meetings.policy.maxMeetingMinutes} dakika; aylık süre dolunca yeni görüşme açılmaz.`
                  : "Görüşme süresi serbest; aylık süreyi aşarsanız görüşme kesilmez, bir üst paket önerilir."}
              </p>
            </div>
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
        {autoOpen ? (
          <Card>
            <CardHeader title="Otomatik veli raporu" description="Rapor sizin adınızla gider; Pi Koç imzası olmaz." />
            <CardBody>
              <AutoReportForm enabled={center.coachAutoReport} />
            </CardBody>
          </Card>
        ) : (
          <LockedFeature feature="autoReport" />
        )}
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

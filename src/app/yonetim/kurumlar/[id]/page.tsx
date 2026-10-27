import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL, CENTER_EDITION_LABEL, CENTER_KIND_LABEL, CENTER_PLAN_LABEL } from "@/lib/center/labels";
import { CENTER_ROLE_LABEL, type CenterRoleName } from "@/lib/center/permissions";
import { centerAccess } from "@/lib/center/subscription";
import { formatCompact, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { centerWhatsappUsage } from "@/server/center/messages";
import { centerPlans } from "@/server/center/plans";
import { getSiteSettings } from "@/server/site";
import { AddOwnerForm, CenterAdminForm, SubscriptionPaymentForm } from "../center-admin-forms";

export const metadata: Metadata = { title: "Kurum" };

export default async function AdminCenterPage({ params }: PageProps<"/yonetim/kurumlar/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const center = await db.center.findUnique({
    where: { id },
    include: {
      city: { select: { name: true } },
      district: { select: { name: true } },
      members: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, username: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } },
      subscriptionPayments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!center) notFound();
  const [students, groups, exams, payments, whatsapp, settings] = await Promise.all([
    db.centerStudent.count({ where: { centerId: id, status: "ACTIVE" } }),
    db.centerGroup.count({ where: { centerId: id, isActive: true } }),
    db.centerExam.count({ where: { centerId: id } }),
    db.centerPayment.count({ where: { centerId: id, cancelledAt: null } }),
    centerWhatsappUsage(id),
    getSiteSettings(),
  ]);
  const access = centerAccess(center);
  const accessLabel = CENTER_ACCESS_LABEL[access.state];
  const plan = centerPlans(settings).find((p) => p.plan === center.plan);
  return (
    <>
      <PageHeader
        title={center.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {CENTER_KIND_LABEL[center.kind]} · {CENTER_EDITION_LABEL[center.edition]} paketi · {CENTER_PLAN_LABEL[center.plan]}
            <Badge tone={accessLabel.tone}>{accessLabel.label}</Badge>
            {center.isPublic ? (
              <Link href={`/kurumlar/${center.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                Vitrin <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : null}
          </span>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Aktif öğrenci" value={`${students}/${center.studentLimit}`} />
        <StatCard label="Sınıf" value={groups} />
        <StatCard label="Deneme" value={exams} />
        <StatCard label="Tahsilat kaydı" value={payments} />
        <StatCard label="WhatsApp (bu ay)" value={`${whatsapp.used}/${whatsapp.limit}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Plan ve süre" />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                { label: "Bitiş", value: access.endsAt ? `${formatDate(access.endsAt)} (${access.daysLeft} gün)` : "Süresiz" },
                { label: "İletişim", value: [center.phone, center.email].filter(Boolean).join(" · ") || "—" },
                { label: "Konum", value: [center.district?.name, center.city?.name].filter(Boolean).join(", ") || "—" },
                { label: "Açılış", value: formatDate(center.createdAt) },
              ]}
            />
            <CenterAdminForm
              center={{
                id: center.id,
                name: center.name,
                kind: center.kind,
                edition: center.edition,
                plan: center.plan,
                status: center.status,
                studentLimit: center.studentLimit,
                trialEndsAt: center.trialEndsAt?.toISOString() ?? null,
                paidUntil: center.paidUntil?.toISOString() ?? null,
              }}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Abonelik ödemesi kaydet" description="Havale/EFT geldikçe kaydedin; süre bitişin üzerine eklenir ve kurum aktif olur." />
          <CardBody>
            <SubscriptionPaymentForm centerId={center.id} plan={center.plan} monthlyPrice={plan?.priceTl ?? null} />
          </CardBody>
          {center.subscriptionPayments.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Tarih</Th>
                  <Th>Dönem</Th>
                  <Th className="text-right">Tutar</Th>
                </tr>
              </thead>
              <tbody>
                {center.subscriptionPayments.map((p) => (
                  <tr key={p.id}>
                    <Td className="text-xs">{formatCompact(p.createdAt)}</Td>
                    <Td className="text-xs">
                      {formatDate(p.periodStart)} – {formatDate(p.periodEnd)} · {p.method}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </Td>
                    <Td className="text-right font-semibold">{formatMoney(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </Card>
        <Card>
          <CardHeader title="Personel" />
          <ul className="divide-y divide-slate-100">
            {center.members.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{[m.user.username, m.user.email, m.user.phone].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-slate-400">{m.user.lastLoginAt ? `Son giriş ${formatCompact(m.user.lastLoginAt)}` : "Giriş yapmadı"}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={m.role === "OWNER" ? "brand" : "slate"}>{CENTER_ROLE_LABEL[m.role as CenterRoleName]}</Badge>
                  {!m.isActive ? <Badge tone="slate">Pasif</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-slate-100">
            <AddOwnerForm centerId={center.id} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

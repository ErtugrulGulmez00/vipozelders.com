import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL, CENTER_KIND_LABEL, CENTER_PLAN_LABEL } from "@/lib/center/labels";
import { coachPlan, coachPlanLabel, coachPriceFor, formatHours, parseCoachTiers } from "@/lib/pi-koc";
import { coachMeetingStatus } from "@/server/koc-meeting-usage";
import { ArrowLeft } from "lucide-react";
import { CENTER_ROLE_LABEL, type CenterRoleName } from "@/lib/center/permissions";
import { centerAccess } from "@/lib/center/subscription";
import { formatCompact, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { centerWhatsappUsage } from "@/server/center/messages";
import { centerPlans } from "@/server/center/plans";
import { getSiteSettings } from "@/server/site";
import { ResetPasswordForm } from "../../ogretmenler/[id]/admin-forms";
import { AddOwnerForm, CenterAdminForm, DeleteCenterForm, SubscriptionPaymentForm } from "../center-admin-forms";

export const metadata: Metadata = { title: "Kurum" };

export default async function AdminCenterPage({ params }: PageProps<"/yonetim/kurumlar/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const center = await db.center.findUnique({
    where: { id },
    include: {
      city: { select: { name: true } },
      district: { select: { name: true } },
      members: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, username: true, lastLoginAt: true, role: true } } }, orderBy: { createdAt: "asc" } },
      subscriptionPayments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!center) notFound();
  const [students, allStudents, groups, exams, payments, whatsapp, settings] = await Promise.all([
    db.centerStudent.count({ where: { centerId: id, status: "ACTIVE" } }),
    db.centerStudent.count({ where: { centerId: id } }),
    db.centerGroup.count({ where: { centerId: id, isActive: true } }),
    db.centerExam.count({ where: { centerId: id } }),
    db.centerPayment.count({ where: { centerId: id, cancelledAt: null } }),
    centerWhatsappUsage(id),
    getSiteSettings(),
  ]);
  const access = centerAccess(center);
  const accessLabel = CENTER_ACCESS_LABEL[access.state];
  const plan = centerPlans(settings).find((p) => p.plan === center.plan);
  // Pi Koç hesabı: kurum kademesi, sınıf ve WhatsApp kotası yerine Pi Koç paketi ve görüşme süresi
  const coach = center.kind === "COACH";
  const tiers = parseCoachTiers(settings.piKocTiers);
  const coachState = coach ? coachPlan(center, settings.piKocFreeStudents) : null;
  const meetings = coach ? await coachMeetingStatus(center.id) : null;
  const owner = center.members.find((m) => m.role === "OWNER");
  return (
    <>
      <Link href={coach ? "/yonetim/pi-koc" : "/yonetim/kurumlar"} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> {coach ? "Pi Koç hesapları" : "Kurumlar"}
      </Link>
      <PageHeader
        title={center.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {coachState ? `Pi Koç · ${coachPlanLabel(coachState)}` : `${CENTER_KIND_LABEL[center.kind]} · ${CENTER_PLAN_LABEL[center.plan]}`}
            {coachState ? (
              <Badge tone={coachState.state === "trial" ? "amber" : coachState.paid ? "green" : "slate"}>{coachState.state === "trial" ? "Deneme" : coachState.paid ? "Ücretli" : "Ücretsiz"}</Badge>
            ) : (
              <Badge tone={accessLabel.tone}>{accessLabel.label}</Badge>
            )}
            {center.isPublic ? (
              <Link href={`/kurumlar/${center.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                Vitrin <ExternalLink className="size-3" aria-hidden />
              </Link>
            ) : null}
          </span>
        }
      />
      {coachState && meetings ? (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Aktif öğrenci" value={`${students}/${coachState.studentLimit}`} hint={coachState.paid ? undefined : `Ücretli pakette ${center.studentLimit}`} />
          <StatCard label="Görüntülü görüşme (bu ay)" value={formatHours(meetings.usedMinutes)} hint={`Aylık süre ${formatHours(meetings.policy.poolMinutes)}`} />
          <StatCard label="Deneme" value={exams} />
          <StatCard label="Paket ödemesi" value={center.subscriptionPayments.length} />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Aktif öğrenci" value={`${students}/${center.studentLimit}`} />
          <StatCard label="Sınıf" value={groups} />
          <StatCard label="Deneme" value={exams} />
          <StatCard label="Tahsilat kaydı" value={payments} />
          <StatCard label="WhatsApp (bu ay)" value={`${whatsapp.used}/${whatsapp.limit}`} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title={coach ? "Paket ve süre" : "Plan ve süre"} />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                ...(coachState
                  ? [
                      { label: "Paket", value: coachPlanLabel(coachState) },
                      {
                        label: "Koç",
                        value: owner ? (
                          owner.user.role === "TEACHER" ? (
                            <Link href={`/yonetim/ogretmenler/${owner.userId}`} className="font-semibold text-brand-700 hover:underline">
                              {owner.user.firstName} {owner.user.lastName} (öğretmen)
                            </Link>
                          ) : (
                            `${owner.user.firstName} ${owner.user.lastName}`
                          )
                        ) : (
                          "—"
                        ),
                      },
                    ]
                  : []),
                { label: "Bitiş", value: coachState && !coachState.paid ? "Süresiz (ücretsiz paket)" : access.endsAt ? `${formatDate(access.endsAt)} (${access.daysLeft} gün)` : "Süresiz" },
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
                plan: center.plan,
                status: center.status,
                studentLimit: center.studentLimit,
                trialEndsAt: center.trialEndsAt?.toISOString() ?? null,
                paidUntil: center.paidUntil?.toISOString() ?? null,
              }}
              coachTiers={coach ? tiers : undefined}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={coach ? "Paket ödemesi kaydet" : "Abonelik ödemesi kaydet"}
            description={coach ? "Havale/EFT geldikçe kaydedin; seçilen paket açılır, süre bitişin üzerine eklenir." : "Havale/EFT geldikçe kaydedin; süre bitişin üzerine eklenir ve kurum aktif olur."}
          />
          <CardBody>
            <SubscriptionPaymentForm
              centerId={center.id}
              plan={center.plan}
              monthlyPrice={coach ? (coachPriceFor(tiers, center.studentLimit) ?? tiers[0]?.priceTl ?? null) : (plan?.priceTl ?? null)}
              coachTiers={coach ? tiers : undefined}
              coachStudents={coach && tiers.some((t) => t.students === center.studentLimit) ? center.studentLimit : undefined}
            />
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
          <CardHeader title={coach ? "Hesap kullanıcıları" : "Personel"} />
          <ul className="divide-y divide-slate-100">
            {center.members.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{[m.user.username, m.user.email, m.user.phone].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-slate-400">{m.user.lastLoginAt ? `Son giriş ${formatCompact(m.user.lastLoginAt)}` : "Giriş yapmadı"}</p>
                  <div className="mt-2">
                    <ResetPasswordForm userId={m.userId} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={m.role === "OWNER" ? "brand" : "slate"}>{coach && m.role === "OWNER" ? "Hesap sahibi" : CENTER_ROLE_LABEL[m.role as CenterRoleName]}</Badge>
                  {!m.isActive ? <Badge tone="slate">Pasif</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
          {coach ? null : (
            <CardBody className="border-t border-slate-100">
              <AddOwnerForm centerId={center.id} />
            </CardBody>
          )}
        </Card>
      </div>
      <Card className="mt-6 border-rose-200">
        <CardHeader
          title={coach ? "Pi Koç hesabını sil" : "Kurumu sil"}
          description={coach ? "Yanlış açılmış hesaplar için. Öğretmen hesabı silinmez; öğretmen panele girince ücretsiz Pi Koç yeniden açılır." : "Deneme ya da yanlış açılmış kurumlar için. Abonelik bitince kurum zaten salt okunur olur; gerçek kurumu silmek yerine askıya alın."}
        />
        <CardBody>
          <DeleteCenterForm centerId={center.id} name={center.name} students={allStudents} coach={coach} />
        </CardBody>
      </Card>
    </>
  );
}

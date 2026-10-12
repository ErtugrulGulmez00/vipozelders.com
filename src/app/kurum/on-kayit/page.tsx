import { ExternalLink, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { LEAD_STATUS } from "@/lib/center/labels";
import { formatCompact } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { DeleteLeadButton, LeadForm, LeadStatusForm } from "./lead-forms";

export const metadata: Metadata = { title: "Ön kayıtlar" };

export default async function LeadsPage({ searchParams }: PageProps<"/kurum/on-kayit">) {
  const ctx = await requireCenter("leads.manage");
  const sp = await searchParams;
  const status = ["NEW", "CONTACTED", "ENROLLED", "LOST"].includes(String(sp.statu)) ? (String(sp.statu) as "NEW" | "CONTACTED" | "ENROLLED" | "LOST") : null;
  const [leads, counts] = await Promise.all([
    db.centerLead.findMany({ where: { centerId: ctx.center.id, ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.centerLead.groupBy({ by: ["status"], where: { centerId: ctx.center.id }, _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <>
      <PageHeader title="Ön kayıtlar" description="Vitrin sayfanızdan gelen ve elle eklenen aday öğrenciler" />
      {!ctx.center.isPublic ? (
        <Alert tone="info" className="mb-4">
          Kurum vitrin sayfanız kapalı. Kurum ayarlarından açarsanız velilerin sitedeki ön kayıt formu doğrudan buraya düşer.
        </Alert>
      ) : (
        <Alert tone="success" className="mb-4">
          Vitrin sayfanız yayında:{" "}
          <Link href={`/kurumlar/${ctx.center.slug}`} target="_blank" className="inline-flex items-center gap-1 font-semibold underline">
            /kurumlar/{ctx.center.slug} <ExternalLink className="size-3" aria-hidden />
          </Link>
        </Alert>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/kurum/on-kayit" className={`rounded-full px-3 py-1 text-xs font-semibold ${!status ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
          Tümü ({counts.reduce((t, c) => t + c._count, 0)})
        </Link>
        {Object.entries(LEAD_STATUS).map(([value, s]) => (
          <Link key={value} href={`/kurum/on-kayit?statu=${value}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${status === value ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
            {s.label} ({countOf(value)})
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-3">
          {leads.length === 0 ? (
            <EmptyState icon={<UserPlus className="size-8" />} title="Aday yok" />
          ) : (
            leads.map((lead) => (
              <Card key={lead.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {lead.studentName} {lead.gradeName ? <span className="font-normal text-slate-500">· {lead.gradeName}</span> : null}
                      </p>
                      <p className="text-sm text-slate-600">
                        {lead.parentName ? `${lead.parentName} · ` : ""}
                        <a href={`tel:${lead.phone}`} className="font-semibold text-brand-700 hover:underline">
                          {lead.phone}
                        </a>
                        {lead.email ? ` · ${lead.email}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCompact(lead.createdAt)} · {lead.source === "web" ? "Vitrin formu" : lead.source}
                      </p>
                    </div>
                    <Badge tone={LEAD_STATUS[lead.status].tone}>{LEAD_STATUS[lead.status].label}</Badge>
                  </div>
                  {lead.message ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{lead.message}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <LeadStatusForm leadId={lead.id} status={lead.status} note={lead.note} />
                    <div className="flex items-center gap-1">
                      {lead.status !== "ENROLLED" && ctx.can("students.edit") ? (
                        <LinkButton href={`/kurum/ogrenciler/yeni?aday=${lead.id}`} size="sm" variant="secondary">
                          Kesin kayda çevir
                        </LinkButton>
                      ) : null}
                      <DeleteLeadButton leadId={lead.id} />
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
        <Card>
          <CardHeader title="Aday ekle" description="Telefonla ya da ziyaretle gelen adaylar" />
          <CardBody>
            <LeadForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

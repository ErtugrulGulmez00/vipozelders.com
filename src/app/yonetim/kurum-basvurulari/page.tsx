import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { CENTER_KIND_LABEL } from "@/lib/center/labels";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { ApplicationStatusForm } from "../kurumlar/center-admin-forms";

export const metadata: Metadata = { title: "Kurum başvuruları" };

const STATUS = { NEW: { label: "Yeni", tone: "amber" }, APPROVED: { label: "Kurum açıldı", tone: "green" }, REJECTED: { label: "Kapatıldı", tone: "slate" } } as const;

export default async function CenterApplicationsPage({ searchParams }: PageProps<"/yonetim/kurum-basvurulari">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const all = sp.hepsi === "1";
  const applications = await db.centerApplication.findMany({
    where: all ? {} : { status: "NEW" },
    include: { city: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Kurum başvuruları"
        description="“Kurumlar için” sayfasından gelen demo ve abonelik talepleri"
        actions={
          <Link href={all ? "/yonetim/kurum-basvurulari" : "/yonetim/kurum-basvurulari?hepsi=1"} className="text-sm font-semibold text-brand-700 hover:underline">
            {all ? "Yalnız yeniler" : "Tümünü göster"}
          </Link>
        }
      />
      {applications.length === 0 ? (
        <EmptyState icon={<Inbox className="size-8" />} title="Bekleyen başvuru yok" />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <Card key={a.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {a.centerName} <span className="font-normal text-slate-500">· {CENTER_KIND_LABEL[a.kind]}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {a.contactName} ·{" "}
                      <a href={`tel:${a.phone}`} className="font-semibold text-brand-700 hover:underline">
                        {a.phone}
                      </a>{" "}
                      · {a.email}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCompact(a.createdAt)}
                      {a.city ? ` · ${a.city.name}` : ""}
                      {a.studentCount ? ` · ${a.studentCount} öğrenci` : ""}
                    </p>
                    {a.message ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">{a.message}</p> : null}
                    {a.note ? <p className="mt-1 text-xs text-slate-500">Not: {a.note}</p> : null}
                  </div>
                  <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {a.status === "NEW" ? (
                    <LinkButton href={`/yonetim/kurumlar?basvuru=${a.id}#yeni-kurum`} size="sm">
                      Kurumu aç
                    </LinkButton>
                  ) : null}
                  {a.status === "APPROVED" && a.centerId ? (
                    <LinkButton href={`/yonetim/kurumlar/${a.centerId}`} size="sm" variant="outline">
                      Kuruma git
                    </LinkButton>
                  ) : null}
                  {a.status !== "APPROVED" ? <ApplicationStatusForm applicationId={a.id} status={a.status} /> : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

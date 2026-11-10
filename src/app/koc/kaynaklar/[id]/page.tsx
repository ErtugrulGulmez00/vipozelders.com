import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash } from "@/components/center/center-ui";
import { DeleteResourceButton, ResourceForm } from "@/components/center/study-forms";
import { HBarList } from "@/components/koc/charts";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { resourceSummary } from "@/server/center/resources";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Kaynak" };

export default async function KocResourcePage({ params, searchParams }: PageProps<"/koc/kaynaklar/[id]">) {
  const ctx = await requireCenter("resources.manage");
  const { id } = await params;
  const sp = await searchParams;
  const resource = await db.centerResource.findFirst({
    where: { id, centerId: ctx.center.id },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true } }, progress: true } } },
  });
  if (!resource) notFound();
  const rows = resource.students.map((s) => ({ ...s, summary: resourceSummary(resource.topics, s.progress) })).sort((a, b) => b.summary.completion - a.summary.completion);
  return (
    <>
      <PageHeader
        title={resource.name}
        description={`${resource.subject}${resource.publisher ? ` · ${resource.publisher}` : ""} · ${resource.topics.length} konu`}
        actions={
          <Link href="/koc/kaynaklar" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Kütüphane
          </Link>
        }
      />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Öğrencilerin ilerlemesi" description="Konu konu giriş öğrencinin Program ve kaynaklar sekmesinde." />
          <CardBody>
            {rows.length ? (
              <HBarList
                rows={rows.map((r) => ({
                  label: `${r.student.firstName} ${r.student.lastName}`,
                  value: r.summary.completion,
                  max: 1,
                  display: `%${Math.round(r.summary.completion * 100)} · ${r.summary.solved} soru`,
                  hint: r.summary.accuracy !== null ? `Doğruluk %${Math.round(r.summary.accuracy * 100)}` : undefined,
                }))}
              />
            ) : (
              <p className="text-sm text-slate-500">Bu kaynak henüz bir öğrenciye eklenmedi. Öğrenci sayfasında Program ve kaynaklar sekmesinden ekleyin.</p>
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Kaynağı düzenle" />
            <CardBody>
              <ResourceForm initial={{ id: resource.id, name: resource.name, subject: resource.subject, publisher: resource.publisher, topics: resource.topics, isActive: resource.isActive }} />
            </CardBody>
          </Card>
          <DeleteResourceButton resourceId={resource.id} />
        </div>
      </div>
    </>
  );
}

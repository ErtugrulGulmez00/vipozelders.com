import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { ResourceForm } from "@/components/center/study-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Kaynak kütüphanesi" };

export default async function KocResourcesPage({ searchParams }: PageProps<"/koc/kaynaklar">) {
  const ctx = await requireCenter("resources.manage");
  const sp = await searchParams;
  const resources = await db.centerResource.findMany({
    where: { centerId: ctx.center.id },
    include: { _count: { select: { students: true } } },
    orderBy: [{ isActive: "desc" }, { subject: "asc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader title="Kaynak kütüphanesi" description="Kitap ve soru bankalarınızı konu listesiyle bir kez tanımlayın; öğrencilere eklediğinizde konu konu ilerlemesini izlersiniz." />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {resources.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {resources.map((r) => (
              <Link key={r.id} href={`/koc/kaynaklar/${r.id}`} className="group rounded-3xl border border-ink-100 bg-white p-4 shadow-xs transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <BookOpen className="size-5" aria-hidden />
                </span>
                <p className="mt-3 font-semibold text-ink-900 group-hover:text-brand-700">{r.name}</p>
                <p className="text-xs text-slate-500">
                  {r.subject}
                  {r.publisher ? ` · ${r.publisher}` : ""}
                </p>
                <p className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <Badge tone="slate">{r.topics.length} konu</Badge>
                  <Badge tone="brand">{r._count.students} öğrenci</Badge>
                  {r.isActive ? null : <Badge tone="slate">Arşiv</Badge>}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<BookOpen className="size-8" />} title="Kütüphaneniz boş" description="Sağdaki formdan ilk kitabınızı ekleyin. Konuları her satıra bir tane yazın." />
        )}
        <Card>
          <CardHeader title="Kaynak ekle" />
          <CardBody>
            <ResourceForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { ResourceForm } from "@/components/center/study-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Kaynaklar" };

export default async function ResourcesPage({ searchParams }: PageProps<"/kurum/kaynaklar">) {
  const ctx = await requireCenter("resources.manage");
  const sp = await searchParams;
  const resources = await db.centerResource.findMany({
    where: { centerId: ctx.center.id },
    include: { _count: { select: { students: true } } },
    orderBy: [{ isActive: "desc" }, { subject: "asc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader title="Kaynaklar ve kitaplar" description="Soru bankalarını ve kitapları konu listesiyle tanımlayın, öğrencilere atayın; konu konu ilerlemeyi ve başarıyı izleyin. Çalışma programı öğrenci kartındaki “Program ve kaynaklar” sekmesindedir." />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {resources.length === 0 ? (
          <EmptyState icon={<BookOpen className="size-8" />} title="Henüz kaynak yok" description="Sağdaki formdan ilk kaynağınızı ekleyin." />
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Kaynak</Th>
                  <Th className="text-right">Konu</Th>
                  <Th className="text-right">Öğrenci</Th>
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <Td>
                      <Link href={`/kurum/kaynaklar/${r.id}`} className="font-semibold text-brand-700 hover:underline">
                        {r.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {r.subject}
                        {r.publisher ? ` · ${r.publisher}` : ""} {r.isActive ? null : <Badge tone="slate">Arşiv</Badge>}
                      </p>
                    </Td>
                    <Td className="text-right">{r.topics.length}</Td>
                    <Td className="text-right">{r._count.students}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
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

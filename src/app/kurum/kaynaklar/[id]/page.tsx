import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash, percent } from "@/components/center/center-ui";
import { AssignResourceForm, DeleteResourceButton, ResourceForm } from "@/components/center/study-forms";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { requireCenter } from "@/server/center/context";
import { resourceSummary } from "@/server/center/resources";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Kaynak" };

export default async function ResourcePage({ params, searchParams }: PageProps<"/kurum/kaynaklar/[id]">) {
  const ctx = await requireCenter("resources.manage");
  const { id } = await params;
  const sp = await searchParams;
  const resource = await db.centerResource.findFirst({
    where: { id, centerId: ctx.center.id },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true, status: true } }, progress: true } } },
  });
  if (!resource) notFound();
  const [groups, students] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } },
    }),
  ]);
  const rows = resource.students
    .map((s) => ({ ...s, summary: resourceSummary(resource.topics, s.progress) }))
    .sort((a, b) => b.summary.completion - a.summary.completion || a.student.firstName.localeCompare(b.student.firstName, "tr"));
  // Konu bazında sınıf ortalaması (ilerleme girilen öğrenciler)
  const topicStats = resource.topics.map((topic) => {
    const entries = rows.map((r) => r.summary.rows.find((t) => t.topic === topic)!);
    const done = entries.filter((e) => e.done).length;
    const correct = entries.reduce((t, e) => t + e.correct, 0);
    const wrong = entries.reduce((t, e) => t + e.wrong, 0);
    return { topic, done, accuracy: correct + wrong ? correct / (correct + wrong) : null };
  });

  return (
    <>
      <PageHeader
        title={resource.name}
        description={`${resource.subject}${resource.publisher ? ` · ${resource.publisher}` : ""} · ${resource.topics.length} konu · ${rows.length} öğrenci`}
        actions={
          <Link href="/kurum/kaynaklar" className="text-sm font-semibold text-brand-700 hover:underline">
            Tüm kaynaklar
          </Link>
        }
      />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Öğrenci ilerlemesi" description="Konuyu bitirenler yeşil. Öğrenci adına tıklayıp konu konu girişi “Program ve kaynaklar” sekmesinden yapılır." />
            {rows.length === 0 ? (
              <CardBody>
                <EmptyState title="Bu kaynak henüz kimseye atanmadı" description="Sağdaki formdan sınıfa ya da öğrencilere atayın." />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                      <th className="sticky left-0 bg-white px-4 py-2 font-medium">Öğrenci</th>
                      <th className="px-2 py-2 text-right font-medium">Bitti</th>
                      <th className="px-2 py-2 text-right font-medium">Soru</th>
                      <th className="px-2 py-2 text-right font-medium">Başarı</th>
                      {resource.topics.map((t, i) => (
                        <th key={t} className="px-1 py-2 text-center font-medium" title={t}>
                          {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2">
                          <Link href={`/kurum/ogrenciler/${r.student.id}?sekme=program`} className="font-medium text-brand-700 hover:underline">
                            {r.student.firstName} {r.student.lastName}
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-right">{percent(r.summary.completion)}</td>
                        <td className="px-2 py-2 text-right">{r.summary.solved}</td>
                        <td className="px-2 py-2 text-right">{r.summary.accuracy !== null ? percent(r.summary.accuracy) : "—"}</td>
                        {r.summary.rows.map((t) => (
                          <td key={t.topic} className="px-1 py-2 text-center" title={`${t.topic}: ${t.solved} soru`}>
                            <span className={cn("inline-block size-3 rounded-sm", t.done ? "bg-emerald-500" : t.solved ? "bg-amber-300" : "bg-slate-200")} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Konular" description="Sınıfta konuyu bitiren öğrenci sayısı ve doğru oranı" />
            <CardBody>
              <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
                {topicStats.map((t, i) => (
                  <li key={t.topic} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-1.5">
                    <span>
                      <span className="text-slate-400">{i + 1}.</span> {t.topic}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {t.done}/{rows.length}
                      {t.accuracy !== null ? ` · ${percent(t.accuracy)}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Öğrencilere ata" />
            <CardBody>
              <AssignResourceForm resourceId={resource.id} groups={groups} students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", ") }))} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Kaynağı düzenle" action={<DeleteResourceButton resourceId={resource.id} />} />
            <CardBody>
              <ResourceForm initial={resource} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

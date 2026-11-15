import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CenterFlash } from "@/components/center/center-ui";
import { QuickHallSetup } from "@/components/center/hall-board";
import { HallForm } from "@/components/center/hall-forms";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { dateStringToDbDate, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Çalışma salonu" };

export default async function StudyHallsPage({ searchParams }: PageProps<"/kurum/calisma-salonu">) {
  const ctx = await requireCenter("attendance.take");
  const sp = await searchParams;
  const today = dateStringToDbDate(toLocalDateString(new Date()));
  const halls = await db.centerStudyHall.findMany({
    where: { centerId: ctx.center.id },
    include: { _count: { select: { students: true } }, days: { where: { date: today }, select: { marks: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  // Tek salon varsa doğrudan yoklamaya; liste için ?liste=1
  const active = halls.filter((h) => h.isActive);
  if (active.length === 1 && !sp.liste && !sp.durum) redirect(`/kurum/calisma-salonu/${active[0].id}`);
  const studentCount = halls.length ? 0 : await db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } });
  return (
    <>
      <PageHeader title="Çalışma salonu / kütüphane" description="Öğrencilerin salona periyot periyot gelip gelmediğini işaretleyin; veliler portaldan görür, gün boyu gelmeyenin velisine bildirim gider." />
      <CenterFlash code={sp.durum} />
      {halls.length === 0 ? (
        <>
          <QuickHallSetup studentCount={studentCount} />
          <details className="mt-4 rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700">Adını ve periyotlarını kendim yazmak istiyorum</summary>
            <div className="border-t border-slate-100 p-5 sm:max-w-md">
              <HallForm />
            </div>
          </details>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">
            {halls.map((h) => {
              const present = h.days.filter((d) => d.marks.includes("G")).length;
              const rate = h._count.students ? present / h._count.students : 0;
              return (
                <Link key={h.id} href={`/kurum/calisma-salonu/${h.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm">
                  <p className="font-semibold text-slate-900">
                    {h.name} {h.isActive ? null : <Badge tone="slate">Arşiv</Badge>}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {h._count.students} öğrenci · {h.periods.length} periyot
                  </p>
                  <div className="mt-4 flex items-baseline justify-between text-sm">
                    <span>
                      Bugün <span className="font-bold text-teal-700">{present}</span>
                      <span className="text-slate-400">/{h._count.students} geldi</span>
                    </span>
                    {h.days.length ? null : <span className="text-xs text-slate-400">yoklama alınmadı</span>}
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-teal-600" style={{ width: `${rate * 100}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
          <Card>
            <CardHeader title="Yeni salon" description="Ayrı bir salon ya da kütüphane katı için." />
            <CardBody>
              <HallForm />
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}

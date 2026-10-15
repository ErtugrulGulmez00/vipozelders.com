import { Library } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { HallForm } from "@/components/center/hall-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
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
  return (
    <>
      <PageHeader title="Çalışma salonu / kütüphane" description="Öğrencilerin salona periyot periyot gelip gelmediğini işaretleyin; veliler portaldan görür, gün boyu gelmeyenin velisine bildirim gider." />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {halls.length === 0 ? (
          <EmptyState icon={<Library className="size-8" />} title="Henüz salon yok" description="Sağdaki formdan ilk salonu ve periyotlarını ekleyin." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {halls.map((h) => {
              const present = h.days.filter((d) => d.marks.includes("G")).length;
              return (
                <Link key={h.id} href={`/kurum/calisma-salonu/${h.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-brand-300">
                  <p className="font-semibold text-slate-900">
                    {h.name} {h.isActive ? null : <Badge tone="slate">Arşiv</Badge>}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {h._count.students} öğrenci · {h.periods.length} periyot
                  </p>
                  <p className="mt-3 text-sm">
                    Bugün: <span className="font-semibold text-emerald-700">{present} geldi</span>
                    {h.days.length ? null : <span className="text-slate-400"> · yoklama alınmadı</span>}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
        <Card>
          <CardHeader title="Salon ekle" />
          <CardBody>
            <HallForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

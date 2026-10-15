import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash, percent, RateBar, rateTone, Tabs } from "@/components/center/center-ui";
import { AddHallStudentsForm, DeleteHallButton, HallForm, HallGrid, HallStudentRow } from "@/components/center/hall-forms";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { addDaysToDateString, dateStringToDbDate, formatDate, isDateString, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { hallReport } from "@/server/center/study-hall";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Çalışma salonu" };

export default async function StudyHallPage({ params, searchParams }: PageProps<"/kurum/calisma-salonu/[id]">) {
  const ctx = await requireCenter("attendance.take");
  const { id } = await params;
  const sp = await searchParams;
  const tab = String(sp.sekme ?? "yoklama");
  const today = toLocalDateString(new Date());
  const date = isDateString(String(sp.tarih ?? "")) ? String(sp.tarih) : today;
  const hall = await db.centerStudyHall.findFirst({
    where: { id, centerId: ctx.center.id },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true, status: true } } } }, days: { where: { date: dateStringToDbDate(date) } } },
  });
  if (!hall) notFound();
  const members = hall.students.filter((s) => s.student.status === "ACTIVE").sort((a, b) => (a.deskNo ?? "").localeCompare(b.deskNo ?? "", "tr", { numeric: true }) || a.student.firstName.localeCompare(b.student.firstName, "tr"));
  const marks = new Map(hall.days.map((d) => [d.studentId, d.marks]));
  const base = `/kurum/calisma-salonu/${hall.id}`;

  return (
    <>
      <PageHeader
        title={hall.name}
        description={`${members.length} öğrenci · ${hall.periods.length} periyot`}
        actions={
          <Link href="/kurum/calisma-salonu" className="text-sm font-semibold text-brand-700 hover:underline">
            Tüm salonlar
          </Link>
        }
      />
      <CenterFlash code={sp.durum} />
      <Tabs
        active={tab}
        tabs={[
          { key: "yoklama", label: "Günlük yoklama", href: `${base}?tarih=${date}` },
          { key: "rapor", label: "Rapor", href: `${base}?sekme=rapor` },
          { key: "ogrenciler", label: "Öğrenciler ve ayarlar", href: `${base}?sekme=ogrenciler` },
        ]}
      />
      {tab === "rapor" ? (
        <HallReportTab hallId={hall.id} today={today} from={isDateString(String(sp.bas ?? "")) ? String(sp.bas) : addDaysToDateString(today, -13)} base={base} />
      ) : tab === "ogrenciler" ? (
        <HallMembersTab ctx={ctx} hall={hall} members={members} />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Link href={`${base}?tarih=${addDaysToDateString(date, -1)}`} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Önceki gün">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <span className="text-sm font-semibold text-slate-800">{formatDate(zonedDateTime(date, 12 * 60))}</span>
            {date < today ? (
              <Link href={`${base}?tarih=${addDaysToDateString(date, 1)}`} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Sonraki gün">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
          {members.length === 0 ? (
            <EmptyState title="Salonda öğrenci yok" description="“Öğrenciler ve ayarlar” sekmesinden öğrenci ekleyin." />
          ) : (
            <HallGrid hallId={hall.id} date={date} periods={hall.periods} students={members.map((m) => ({ id: m.studentId, name: `${m.student.firstName} ${m.student.lastName}`, deskNo: m.deskNo, marks: marks.get(m.studentId) ?? "" }))} />
          )}
        </>
      )}
    </>
  );
}

async function HallReportTab({ hallId, today, from, base }: { hallId: string; today: string; from: string; base: string }) {
  const rows = await hallReport(hallId, from, today);
  return (
    <Card>
      <CardHeader
        title="Katılım raporu"
        description={`${from.split("-").reverse().join(".")} – ${today.split("-").reverse().join(".")} · en az katılan başta`}
        action={
          <div className="flex gap-2 text-sm">
            <Link href={`${base}?sekme=rapor&bas=${addDaysToDateString(today, -6)}`} className="font-semibold text-brand-700 hover:underline">
              Son 7 gün
            </Link>
            <Link href={`${base}?sekme=rapor&bas=${addDaysToDateString(today, -29)}`} className="font-semibold text-brand-700 hover:underline">
              Son 30 gün
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">Bu aralıkta yoklama yok.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.studentId} className="px-5 py-3">
              <div className="mb-1 flex justify-between text-sm">
                <Link href={`/kurum/ogrenciler/${r.studentId}?sekme=devam`} className="font-semibold text-slate-900 hover:underline">
                  {r.name}
                </Link>
                <span className="text-slate-600">
                  {r.days} gün · {r.present}/{r.marked} periyot · <strong>{percent(r.rate)}</strong>
                </span>
              </div>
              <RateBar value={r.rate} tone={rateTone(r.rate)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function HallMembersTab({ ctx, hall, members }: { ctx: Awaited<ReturnType<typeof requireCenter>>; hall: { id: string; name: string; periods: string[]; isActive: boolean }; members: { studentId: string; deskNo: string | null; student: { firstName: string; lastName: string } }[] }) {
  const [groups, students] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE", halls: { none: { hallId: hall.id } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } },
    }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <Card>
        <CardHeader title="Salondaki öğrenciler" description="Masa numarası yoklama listesinde sıralamayı belirler." />
        <CardBody className="divide-y divide-slate-100">
          {members.length ? members.map((m) => <HallStudentRow key={m.studentId} hallId={hall.id} studentId={m.studentId} name={`${m.student.firstName} ${m.student.lastName}`} deskNo={m.deskNo} />) : <p className="text-sm text-slate-500">Henüz öğrenci yok.</p>}
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Öğrenci ekle" />
          <CardBody>
            <AddHallStudentsForm hallId={hall.id} groups={groups} students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", ") }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Salon ayarları" action={ctx.can("groups.manage") ? <DeleteHallButton hallId={hall.id} /> : null} />
          <CardBody>
            <HallForm initial={hall} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

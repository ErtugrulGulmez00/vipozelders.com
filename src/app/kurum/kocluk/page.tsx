import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CoachAssignForm } from "@/components/center/coaching-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { addDaysToDateString, minutesToTime, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { coachingOverview } from "@/server/center/coaching";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Koçluk" };

const STATUS = {
  DONE: { label: "Görüşüldü", tone: "green" },
  MISSED: { label: "Gelmedi", tone: "rose" },
  OVERDUE: { label: "Görüşme bekliyor", tone: "amber" },
  TODAY: { label: "Bugün", tone: "brand" },
  UPCOMING: { label: "Planlı", tone: "slate" },
} as const;

export default async function CoachingPage({ searchParams }: PageProps<"/kurum/kocluk">) {
  const ctx = await requireCenter("coaching.manage");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const manager = ctx.member.role === "OWNER" || ctx.member.role === "MANAGER";
  const assign = manager && sp.atama === "1";
  const overview = await coachingOverview(ctx, today);
  const done = overview.rows.filter((r) => r.status === "DONE").length;
  const todayRows = overview.rows.filter((r) => r.status === "TODAY" || r.status === "OVERDUE");

  if (assign) {
    const [students, coaches] = await Promise.all([
      db.centerStudent.findMany({
        where: { centerId: ctx.center.id, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, coachId: true, coachWeekday: true, coachMinute: true, groups: { select: { group: { select: { name: true } } } } },
      }),
      db.centerMember.findMany({ where: { centerId: ctx.center.id, isActive: true, role: { in: ["OWNER", "MANAGER", "TEACHER"] } }, include: { user: { select: { firstName: true, lastName: true } } } }),
    ]);
    return (
      <>
        <PageHeader
          title="Koç ataması"
          description="Her öğrenciye bir koç ve haftalık görüşme günü-saati verin. Koçlar o gün “bugün görüşeceğiniz öğrenciler” listesinde görür."
          actions={
            <Link href="/kurum/kocluk" className="text-sm font-semibold text-brand-700 hover:underline">
              ← Koçluk
            </Link>
          }
        />
        <CoachAssignForm
          coaches={coaches.map((c) => ({ id: c.id, name: `${c.user.firstName} ${c.user.lastName}${c.branch ? ` · ${c.branch}` : ""}` }))}
          rows={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", "), coachId: s.coachId, weekday: s.coachWeekday, time: s.coachMinute !== null ? minutesToTime(s.coachMinute) : "" }))}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Koçluk ve rehberlik"
        description={`Bu hafta (${overview.weekStart.slice(8)}.${overview.weekStart.slice(5, 7)} – ${addDaysToDateString(overview.weekStart, 6).slice(8)}.${addDaysToDateString(overview.weekStart, 6).slice(5, 7)}) koç görüşmeleri`}
        actions={
          manager ? (
            <Link href="/kurum/kocluk?atama=1" className="text-sm font-semibold text-brand-700 hover:underline">
              Koç ataması
            </Link>
          ) : null
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={manager ? "Koçu olan öğrenci" : "Öğrencilerim"} value={overview.rows.length} hint={manager && overview.unassigned ? `${overview.unassigned} öğrencinin koçu yok` : undefined} />
        <StatCard label="Bu hafta görüşülen" value={`${done}/${overview.rows.length}`} />
        <StatCard label="Bekleyen" value={overview.rows.filter((r) => r.status === "OVERDUE").length} hint="Günü geçmiş, kayıt yok" />
        <StatCard label="Bugün" value={overview.rows.filter((r) => r.status === "TODAY").length} />
      </div>
      {overview.rows.length === 0 ? (
        <EmptyState icon={<HeartHandshake className="size-8" />} title="Henüz koç ataması yok" description={manager ? "“Koç ataması” ekranından öğrencilere koç ve görüşme saati verin." : "Kurum yöneticiniz size öğrenci atadığında burada görünür."} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <Card>
            <CardHeader title="Bu haftanın görüşmeleri" description="Öğrenciye tıklayıp görüşmeyi kaydedin." />
            <ul className="divide-y divide-slate-100">
              {overview.rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/kurum/ogrenciler/${r.id}?sekme=kocluk`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {r.weekday ? WEEKDAY_NAMES[r.weekday - 1] : "Gün belirlenmedi"}
                        {r.minute !== null ? ` ${minutesToTime(r.minute)}` : ""}
                        {r.groups ? ` · ${r.groups}` : ""}
                      </p>
                    </div>
                    <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Bugün görüşülecekler" />
              <CardBody>
                {todayRows.length ? (
                  <ul className="space-y-1.5 text-sm">
                    {todayRows.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <Link href={`/kurum/ogrenciler/${r.id}?sekme=kocluk`} className="font-medium text-brand-700 hover:underline">
                          {r.name}
                        </Link>
                        <span className="text-slate-500">{r.status === "OVERDUE" ? "gecikti" : r.minute !== null ? minutesToTime(r.minute) : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">Bugün için bekleyen görüşme yok.</p>
                )}
              </CardBody>
            </Card>
            {manager && overview.coachStats.length ? (
              <Card>
                <CardHeader title="Koordinatör özeti" description="Koç başına bu haftanın görüşmeleri" />
                <ul className="divide-y divide-slate-100 text-sm">
                  {overview.coachStats.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                      <span className="font-medium text-slate-900">{c.name}</span>
                      <span className="text-slate-600">
                        {c.done}/{c.students} görüşme {c.overdue ? <Badge tone="amber">{c.overdue} bekliyor</Badge> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

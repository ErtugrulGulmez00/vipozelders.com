import { UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { WEEKDAY_SHORT, minutesToTime } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { centerTeachers } from "@/server/center/groups";
import { db } from "@/server/db";
import { GroupForm } from "./group-forms";

export const metadata: Metadata = { title: "Sınıflar" };

export default async function GroupsPage({ searchParams }: PageProps<"/kurum/siniflar">) {
  const ctx = await requireCenter("students.view");
  const sp = await searchParams;
  const showArchived = sp.arsiv === "1";
  const [groups, teachers] = await Promise.all([
    db.centerGroup.findMany({
      where: { centerId: ctx.center.id, isActive: !showArchived },
      include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        slots: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
        _count: { select: { students: { where: { student: { status: "ACTIVE" } } } } },
      },
      orderBy: { name: "asc" },
    }),
    centerTeachers(ctx.center.id),
  ]);
  const canManage = ctx.can("groups.manage");
  return (
    <>
      <PageHeader
        title="Sınıflar"
        description="Öğrenci grupları, sorumlu öğretmenler ve haftalık ders saatleri"
        actions={
          <Link href={showArchived ? "/kurum/siniflar" : "/kurum/siniflar?arsiv=1"} className="text-sm font-semibold text-brand-700 hover:underline">
            {showArchived ? "Etkin sınıflar" : "Arşivdeki sınıflar"}
          </Link>
        }
      />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          {groups.length === 0 ? (
            <EmptyState icon={<UsersRound className="size-8" />} title={showArchived ? "Arşivde sınıf yok" : "Henüz sınıf yok"} description="Sınıf açıp öğrencileri ekleyin; haftalık programı girince yoklama listeleri her gün otomatik hazırlanır." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <Link key={g.id} href={`/kurum/siniflar/${g.id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-brand-300 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold text-slate-900 group-hover:text-brand-700">{g.name}</h2>
                    <Badge tone="brand">{g._count.students}{g.capacity ? `/${g.capacity}` : ""} öğrenci</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {[g.gradeName, g.targetExam, g.room].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{g.teacher ? `Rehber: ${g.teacher.user.firstName} ${g.teacher.user.lastName}` : "Rehber öğretmen atanmadı"}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {g.slots.length
                      ? `${g.slots.length} ders/hafta · ${[...new Set(g.slots.map((s) => WEEKDAY_SHORT[s.weekday - 1]))].join(", ")} · ${minutesToTime(Math.min(...g.slots.map((s) => s.startMinute)))}'dan itibaren`
                      : "Haftalık program girilmedi"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
        {canManage && !showArchived ? (
          <Card>
            <CardHeader title="Yeni sınıf" />
            <CardBody>
              <GroupForm teachers={teachers} />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}

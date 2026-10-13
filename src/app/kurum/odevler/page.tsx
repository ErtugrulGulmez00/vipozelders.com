import { NotebookPen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash, percent, shortDate } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { HomeworkForm } from "./homework-forms";

export const metadata: Metadata = { title: "Ödevler" };

export default async function HomeworkListPage({ searchParams }: PageProps<"/kurum/odevler">) {
  const ctx = await requireCenter("homework.manage");
  const sp = await searchParams;
  const past = sp.gecmis === "1";
  const today = toLocalDateString(new Date());
  const mine = ctx.member.role === "TEACHER";
  const [homeworks, groups, students] = await Promise.all([
    db.centerHomework.findMany({
      where: { centerId: ctx.center.id, ...(past ? { dueDate: { lt: dateStringToDbDate(addDaysToDateString(today, -14)) } } : { dueDate: { gte: dateStringToDbDate(addDaysToDateString(today, -14)) } }), ...(mine ? { teacherId: ctx.member.id } : {}) },
      include: {
        group: { select: { name: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        students: { select: { status: true } },
      },
      orderBy: { dueDate: past ? "desc" : "asc" },
      take: 200,
    }),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } },
    }),
  ]);
  return (
    <>
      <PageHeader
        title="Ödevler"
        description="Sınıfa ödev verin, teslimde kontrol edin; veliler veli portalından takip eder."
        actions={
          <Link href={past ? "/kurum/odevler" : "/kurum/odevler?gecmis=1"} className="text-sm font-semibold text-brand-700 hover:underline">
            {past ? "Güncel ödevler" : "Eski ödevler"}
          </Link>
        }
      />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        {homeworks.length === 0 ? (
          <EmptyState icon={<NotebookPen className="size-8" />} title={past ? "Eski ödev yok" : "Güncel ödev yok"} description="Sağdaki formdan sınıfa ödev verin." />
        ) : (
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Ödev</Th>
                  <Th>Teslim</Th>
                  <Th className="text-right">Yapan</Th>
                  <Th>Durum</Th>
                </tr>
              </thead>
              <tbody>
                {homeworks.map((h) => {
                  const checked = h.students.filter((s) => s.status !== "PENDING");
                  const done = checked.filter((s) => s.status === "DONE").length;
                  const due = dbDateToString(h.dueDate);
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/60">
                      <Td>
                        <Link href={`/kurum/odevler/${h.id}`} className="font-semibold text-brand-700 hover:underline">
                          {h.subject}: {h.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {h.group?.name ?? `${h.students.length} öğrenci`}
                          {h.teacher ? ` · ${h.teacher.user.firstName} ${h.teacher.user.lastName}` : ""}
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap text-xs">{shortDate(h.dueDate)}</Td>
                      <Td className="whitespace-nowrap text-right text-sm">{checked.length ? `${done}/${h.students.length} (${percent(done / h.students.length)})` : "—"}</Td>
                      <Td>
                        {h.checkedAt ? <Badge tone="green">Kontrol edildi</Badge> : due < today ? <Badge tone="amber">Kontrol bekliyor</Badge> : due === today ? <Badge tone="sky">Bugün teslim</Badge> : <Badge tone="slate">Devam ediyor</Badge>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}
        <Card>
          <CardHeader title="Ödev ver" />
          <CardBody>
            {groups.length || students.length ? (
              <HomeworkForm
                groups={groups}
                today={today}
                nextWeek={addDaysToDateString(today, 7)}
                students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", ") }))}
              />
            ) : (
              <p className="text-sm text-slate-500">Önce öğrenci ve sınıf ekleyin.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

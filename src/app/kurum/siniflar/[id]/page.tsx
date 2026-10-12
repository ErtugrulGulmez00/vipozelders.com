import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { percent } from "@/components/center/center-ui";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { WEEKDAY_NAMES, addDaysToDateString, minutesToTime, toLocalDateString } from "@/lib/dates";
import { attendanceReport } from "@/server/center/attendance";
import { requireCenter } from "@/server/center/context";
import { centerTeachers } from "@/server/center/groups";
import { db } from "@/server/db";
import { ArchiveGroupForm, DeleteSlotButton, GroupForm, GroupStudentsForm, SlotForm } from "../group-forms";

export const metadata: Metadata = { title: "Sınıf" };

export default async function GroupPage({ params }: PageProps<"/kurum/siniflar/[id]">) {
  const ctx = await requireCenter("students.view");
  const { id } = await params;
  const centerId = ctx.center.id;
  const group = await db.centerGroup.findFirst({
    where: { id, centerId },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      slots: { include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
      students: { include: { student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, gradeName: true, status: true } } } },
    },
  });
  if (!group) notFound();
  const canManage = ctx.can("groups.manage");
  const today = toLocalDateString(new Date());
  const [teachers, allStudents, report] = await Promise.all([
    canManage ? centerTeachers(centerId) : Promise.resolve([]),
    canManage ? db.centerStudent.findMany({ where: { centerId, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true, gradeName: true } }) : Promise.resolve([]),
    attendanceReport(centerId, addDaysToDateString(today, -30), today, group.id),
  ]);
  const members = group.students.map((s) => s.student).sort((a, b) => a.firstName.localeCompare(b.firstName, "tr"));
  const reportById = new Map(report.map((r) => [r.studentId, r]));
  return (
    <>
      <PageHeader
        title={group.name}
        description={[group.gradeName, group.targetExam, group.room, group.teacher ? `Rehber: ${group.teacher.user.firstName} ${group.teacher.user.lastName}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            {ctx.can("attendance.take") ? (
              <LinkButton href={`/kurum/yoklama?grup=${group.id}`} size="sm" variant="outline">
                Yoklama
              </LinkButton>
            ) : null}
            {canManage ? <ArchiveGroupForm groupId={group.id} isActive={group.isActive} /> : null}
          </>
        }
      />
      {!group.isActive ? <Badge tone="slate" className="mb-4">Arşivde</Badge> : null}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title={`Öğrenciler (${members.length})`} description="Son 30 günün devam oranı" />
          {members.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>No</Th>
                  <Th>Öğrenci</Th>
                  <Th className="text-right">Devamsızlık</Th>
                  <Th className="text-right">Devam</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((s) => {
                  const r = reportById.get(s.id);
                  return (
                    <tr key={s.id}>
                      <Td className="font-mono text-xs text-slate-500">{s.studentNumber ?? "—"}</Td>
                      <Td>
                        <Link href={`/kurum/ogrenciler/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.status !== "ACTIVE" ? <Badge tone="slate" className="ml-2">{s.status === "LEFT" ? "Ayrıldı" : "Pasif"}</Badge> : null}
                      </Td>
                      <Td className="text-right text-sm">{r ? r.absent : "—"}</Td>
                      <Td className="text-right text-sm">{r ? percent(r.rate) : "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <CardBody>
              <p className="text-sm text-slate-500">Bu sınıfta öğrenci yok.</p>
            </CardBody>
          )}
        </Card>
        <Card>
          <CardHeader title="Haftalık program" />
          {group.slots.length ? (
            <ul className="divide-y divide-slate-100">
              {group.slots.map((slot) => (
                <li key={slot.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {WEEKDAY_NAMES[slot.weekday - 1]} {minutesToTime(slot.startMinute)}–{minutesToTime(slot.endMinute)} · {slot.subject}
                    </p>
                    <p className="text-xs text-slate-500">{[slot.teacher ? `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}` : null, slot.room].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  {canManage ? <DeleteSlotButton slotId={slot.id} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <p className="text-sm text-slate-500">Henüz ders saati yok.</p>
            </CardBody>
          )}
          {canManage ? (
            <CardBody className="border-t border-slate-100">
              <SlotForm groupId={group.id} teachers={teachers} defaultRoom={group.room} />
            </CardBody>
          ) : null}
        </Card>
        {canManage ? (
          <>
            <Card>
              <CardHeader title="Sınıf listesini düzenle" description="İşaretli öğrenciler sınıfta olur." />
              <CardBody>
                <GroupStudentsForm groupId={group.id} selected={members.map((m) => m.id)} students={allStudents.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, gradeName: s.gradeName }))} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Sınıf bilgileri" />
              <CardBody>
                <GroupForm teachers={teachers} values={{ id: group.id, name: group.name, gradeName: group.gradeName, targetExam: group.targetExam, teacherId: group.teacherId, room: group.room, capacity: group.capacity }} />
              </CardBody>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}

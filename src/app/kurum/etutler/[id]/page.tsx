import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ETUD_STATUS } from "@/lib/center/labels";
import { dbDateToString, formatDate, minutesToTime, zonedDateTime } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { centerTeachers } from "@/server/center/groups";
import { db } from "@/server/db";
import { EtudAttendanceForm, EtudForm, EtudStatusButtons } from "../etud-forms";

export const metadata: Metadata = { title: "Etüt" };

export default async function EtudPage({ params, searchParams }: PageProps<"/kurum/etutler/[id]">) {
  const ctx = await requireCenter("etud.manage");
  const { id } = await params;
  const sp = await searchParams;
  const etud = await db.centerEtud.findFirst({
    where: { id, centerId: ctx.center.id },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      students: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  if (!etud) notFound();
  const editable = ctx.member.role !== "TEACHER" || !etud.teacherId || etud.teacherId === ctx.member.id;
  const [teachers, students] = await Promise.all([
    centerTeachers(ctx.center.id),
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } },
    }),
  ]);
  const date = dbDateToString(etud.date);
  return (
    <>
      <PageHeader
        title={`${etud.subject}${etud.topic ? ` — ${etud.topic}` : ""}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {formatDate(zonedDateTime(date, 12 * 60))} · {minutesToTime(etud.startMinute)}–{minutesToTime(etud.endMinute)}
            {etud.teacher ? ` · ${etud.teacher.user.firstName} ${etud.teacher.user.lastName}` : ""}
            {etud.room ? ` · ${etud.room}` : ""}
            <Badge tone={ETUD_STATUS[etud.status].tone}>{ETUD_STATUS[etud.status].label}</Badge>
          </span>
        }
        actions={editable ? <EtudStatusButtons etudId={etud.id} status={etud.status} /> : null}
      />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Katılım" description={etud.status === "DONE" ? "Etüt yapıldı; katılımı düzeltebilirsiniz." : "Etüt bitince katılımı işaretleyin."} />
          <CardBody>
            {editable && etud.status !== "CANCELLED" ? (
              <EtudAttendanceForm
                etudId={etud.id}
                notes={etud.notes}
                notifyAvailable={ctx.center.notifyAbsence}
                students={etud.students.map((s) => ({ id: s.student.id, name: `${s.student.firstName} ${s.student.lastName}`, status: s.attendance }))}
              />
            ) : (
              <ul className="space-y-1 text-sm">
                {etud.students.map((s) => (
                  <li key={s.studentId}>
                    <Link href={`/kurum/ogrenciler/${s.studentId}`} className="text-brand-700 hover:underline">
                      {s.student.firstName} {s.student.lastName}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        {editable ? (
          <Card>
            <CardHeader title="Etüdü düzenle" />
            <CardBody>
              <EtudForm
                teacherLocked={ctx.member.role === "TEACHER"}
                teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
                students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", ") }))}
                values={{
                  id: etud.id,
                  date,
                  start: minutesToTime(etud.startMinute),
                  end: minutesToTime(etud.endMinute),
                  teacherId: etud.teacherId,
                  subject: etud.subject,
                  topic: etud.topic,
                  room: etud.room,
                  notes: etud.notes,
                  studentIds: etud.students.map((s) => s.studentId),
                }}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}

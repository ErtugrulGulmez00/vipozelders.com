import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash, shortDate } from "@/components/center/center-ui";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { DeleteHomeworkButton, HomeworkCheckForm } from "../homework-forms";

export const metadata: Metadata = { title: "Ödev kontrolü" };

export default async function HomeworkPage({ params, searchParams }: PageProps<"/kurum/odevler/[id]">) {
  const ctx = await requireCenter("homework.manage");
  const { id } = await params;
  const sp = await searchParams;
  const homework = await db.centerHomework.findFirst({
    where: { id, centerId: ctx.center.id },
    include: {
      group: { select: { name: true } },
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      students: { include: { student: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { student: { firstName: "asc" } } },
    },
  });
  if (!homework) notFound();
  const editable = ctx.member.role !== "TEACHER" || !homework.teacherId || homework.teacherId === ctx.member.id;
  return (
    <>
      <PageHeader
        title={`${homework.subject}: ${homework.title}`}
        description={[homework.group?.name, `Veriliş ${shortDate(homework.assignedOn)}`, `Teslim ${shortDate(homework.dueDate)}`, homework.teacher ? `${homework.teacher.user.firstName} ${homework.teacher.user.lastName}` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href="/kurum/odevler" className="text-sm font-semibold text-brand-700 hover:underline">
              ← Ödevler
            </Link>
            {editable ? <DeleteHomeworkButton homeworkId={homework.id} /> : null}
          </>
        }
      />
      <CenterFlash code={sp.durum} />
      {homework.description ? (
        <Card className="mb-4">
          <CardBody className="whitespace-pre-line text-sm text-slate-700">{homework.description}</CardBody>
        </Card>
      ) : null}
      {editable ? (
        <HomeworkCheckForm
          homeworkId={homework.id}
          students={homework.students.map((s) => ({ id: s.student.id, name: `${s.student.firstName} ${s.student.lastName}`, status: s.status, note: s.note, notified: Boolean(s.notifiedAt) }))}
        />
      ) : (
        <p className="text-sm text-slate-500">Bu ödevi başka bir öğretmen verdi; yalnızca o kontrol edebilir.</p>
      )}
    </>
  );
}

import type { Metadata } from "next";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { isDateString, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { centerTeachers } from "@/server/center/groups";
import { db } from "@/server/db";
import { EtudForm } from "../etud-forms";

export const metadata: Metadata = { title: "Etüt planla" };

export default async function NewEtudPage({ searchParams }: PageProps<"/kurum/etutler/yeni">) {
  const ctx = await requireCenter("etud.manage");
  const sp = await searchParams;
  const date = isDateString(String(sp.tarih ?? "")) ? String(sp.tarih) : toLocalDateString(new Date());
  const preselected = sp.ogrenci ? [String(sp.ogrenci)] : [];
  const [teachers, students] = await Promise.all([
    centerTeachers(ctx.center.id),
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="Etüt planla" description="Aynı saatte öğretmenin, dersliğin ya da öğrencinin başka etüdü varsa uyarılırsınız." />
      <Card>
        <CardBody>
          <EtudForm
            teacherLocked={ctx.member.role === "TEACHER"}
            teachers={teachers.map((t) => ({ id: t.id, name: t.name }))}
            students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", ") }))}
            values={{ date, start: "17:00", end: "17:40", teacherId: ctx.member.role === "TEACHER" ? ctx.member.id : null, studentIds: preselected }}
          />
        </CardBody>
      </Card>
    </>
  );
}

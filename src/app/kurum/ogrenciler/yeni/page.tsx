import type { Metadata } from "next";
import Link from "next/link";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Yeni öğrenci" };

export default async function NewStudentPage({ searchParams }: PageProps<"/kurum/ogrenciler/yeni">) {
  const ctx = await requireCenter("students.edit");
  const leadId = String((await searchParams).aday ?? "") || null;
  const [groups, lead, active] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    leadId ? db.centerLead.findFirst({ where: { id: leadId, centerId: ctx.center.id } }) : null,
    db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } }),
  ]);
  const [firstName, ...rest] = (lead?.studentName ?? "").split(" ");
  return (
    <>
      <PageHeader
        title="Yeni öğrenci"
        description={
          <>
            Toplu kayıt için{" "}
            <Link href="/kurum/ogrenciler/ice-aktar" className="font-semibold text-brand-700 hover:underline">
              Excel’den aktarın
            </Link>
            .
          </>
        }
      />
      {active >= ctx.center.studentLimit ? (
        <Alert tone="warning" className="mb-6" title="Öğrenci sınırına ulaştınız">
          Planınızda en fazla {ctx.center.studentLimit} aktif öğrenci olabilir. Ayrılan öğrencileri “Ayrıldı” yapın ya da planınızı yükseltin.
        </Alert>
      ) : null}
      {lead ? (
        <Alert tone="info" className="mb-6" title="Ön kayıttan kesin kayıt">
          {lead.studentName} adayının bilgileri dolduruldu. Veli: {lead.parentName ?? "—"} · {lead.phone}. Kayıt tamamlanınca aday “Kayıt oldu” olarak işaretlenir.
        </Alert>
      ) : null}
      <StudentForm
        mode="create"
        groups={groups}
        leadId={lead?.id}
        values={lead ? { firstName, lastName: rest.join(" "), gradeName: lead.gradeName, phone: null, notes: lead.message } : undefined}
      />
    </>
  );
}

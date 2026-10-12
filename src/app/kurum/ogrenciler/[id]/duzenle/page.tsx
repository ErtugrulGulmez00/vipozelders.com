import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/primitives";
import { dbDateToString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { decryptText, maskIdentityNumber } from "@/server/crypto";
import { db } from "@/server/db";
import { StudentForm } from "../../student-form";

export const metadata: Metadata = { title: "Öğrenciyi düzenle" };

export default async function EditStudentPage({ params }: PageProps<"/kurum/ogrenciler/[id]/duzenle">) {
  const ctx = await requireCenter("students.edit");
  const { id } = await params;
  const [student, groups] = await Promise.all([
    db.centerStudent.findFirst({ where: { id, centerId: ctx.center.id }, include: { groups: { select: { groupId: true } } } }),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!student) notFound();
  let identityMasked: string | null = null;
  if (student.identityNumberEnc) {
    try {
      identityMasked = maskIdentityNumber(decryptText(student.identityNumberEnc));
    } catch {
      identityMasked = "***";
    }
  }
  return (
    <>
      <PageHeader title={`${student.firstName} ${student.lastName}`} description="Öğrenci bilgilerini düzenleyin. Veliler öğrenci kartından düzenlenir." />
      <StudentForm
        mode="edit"
        groups={groups}
        values={{
          id: student.id,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          gender: student.gender,
          birthDate: student.birthDate ? dbDateToString(student.birthDate) : null,
          identityMasked,
          schoolName: student.schoolName,
          gradeName: student.gradeName,
          targetExam: student.targetExam,
          phone: student.phone,
          email: student.email,
          address: student.address,
          notes: student.notes,
          groupIds: student.groups.map((g) => g.groupId),
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { KocStudentForm } from "@/components/koc/koc-forms";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Öğrenci ekle" };

export default async function KocNewStudentPage() {
  const ctx = await requireCenter("students.edit");
  const active = await db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } });
  const full = active >= ctx.center.studentLimit;
  return (
    <>
      <PageHeader
        title="Öğrenci ekle"
        description={`${active}/${ctx.center.studentLimit} öğrenci`}
        actions={
          <Link href="/koc/ogrenciler" className="text-sm font-semibold text-brand-700 hover:underline">
            ← Öğrencilerim
          </Link>
        }
      />
      {full ? (
        <Alert tone="warning" title="Öğrenci sınırınız doldu" className="mb-6">
          Yeni öğrenci için bir öğrenciyi arşive alın ya da daha büyük pakete geçin (Hesap ve abonelik).
        </Alert>
      ) : null}
      <Card className="max-w-3xl">
        <CardBody>
          <KocStudentForm />
        </CardBody>
      </Card>
    </>
  );
}

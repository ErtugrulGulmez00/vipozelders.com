import type { Metadata } from "next";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { NewTeacherForm } from "./new-teacher-form";

export const metadata: Metadata = { title: "Hızlı öğretmen ekle" };

export default async function NewTeacherPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader
        title="Hızlı öğretmen ekle"
        description="Ad ve soyad yeterli: kullanıcı adı ve geçici şifre otomatik üretilir. Profil, ders ve takvim bilgilerini sonra siz ya da öğretmen doldurabilir."
      />
      <Card className="max-w-3xl">
        <CardBody className="p-6">
          <NewTeacherForm />
        </CardBody>
      </Card>
    </>
  );
}

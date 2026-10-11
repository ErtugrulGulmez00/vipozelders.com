import type { Metadata } from "next";
import { OfferingsEditor } from "@/components/teacher/offerings-editor";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { formatBps } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { getCatalog } from "@/server/site";
import { loadTeacherEditorData } from "@/server/teacher-editor-data";

export const metadata: Metadata = { title: "Dersler ve fiyatlar" };

export default async function OfferingsPage() {
  const user = await requireRole("TEACHER");
  const [data, catalog] = await Promise.all([loadTeacherEditorData(user.id), getCatalog()]);
  return (
    <>
      <PageHeader title="Dersler ve fiyatlar" description="Verdiğiniz her kademe, ders ve hizmet için ayrı saatlik ücret belirleyebilirsiniz." />
      <Alert tone="info" className="mb-6">
        Girdiğiniz ücret velinin ödeyeceği, KDV dahil saatlik tutardır. Platform hizmet bedeli {formatBps(data.commissionBps)}; kalan tutar ders tamamlandıktan sonra hakedişinize eklenir. Süreye göre ücret otomatik hesaplanır (ör. 90 dk = 1,5 saat).
      </Alert>
      <Card>
        <CardBody className="p-6">
          <OfferingsEditor teacherId={user.id} catalog={catalog} offerings={data.offerings} commissionBps={data.commissionBps} />
        </CardBody>
      </Card>
    </>
  );
}

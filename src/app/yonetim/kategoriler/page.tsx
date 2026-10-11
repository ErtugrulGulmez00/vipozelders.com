import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { loadCatalog } from "@/server/catalog";
import { LevelForm, ServiceForm, SubjectForm } from "./catalog-forms";

export const metadata: Metadata = { title: "Kategoriler" };

export default async function CatalogPage() {
  await requireRole("ADMIN");
  const catalog = await loadCatalog({ includeInactive: true });
  return (
    <>
      <PageHeader title="Kategoriler" description="Kademeler, dersler ve hizmet türleri. Değişiklikler vitrindeki arama ve filtrelere hemen yansır." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Kademeler" description="Her kademede hangi derslerin verildiğini işaretleyin." />
          <CardBody className="space-y-6">
            {catalog.levels.map((level) => (
              <div key={level.id} className="rounded-xl border border-slate-200 p-4">
                <LevelForm level={level} subjects={catalog.subjects} />
              </div>
            ))}
            <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/30 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Yeni kademe</p>
              <LevelForm subjects={catalog.subjects} />
            </div>
          </CardBody>
        </Card>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Dersler" />
            <CardBody className="space-y-2">
              {catalog.subjects.map((subject) => (
                <SubjectForm key={subject.id} subject={subject} />
              ))}
              <div className="border-t border-slate-100 pt-3">
                <SubjectForm />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Hizmet türleri" />
            <CardBody className="space-y-2">
              {catalog.services.map((service) => (
                <ServiceForm key={service.id} service={service} />
              ))}
              <div className="border-t border-slate-100 pt-3">
                <ServiceForm />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

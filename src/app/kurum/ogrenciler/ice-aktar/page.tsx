import { Download } from "lucide-react";
import type { Metadata } from "next";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { STUDENT_TEMPLATE_HEADERS } from "@/lib/center/import";
import { requireCenter } from "@/server/center/context";
import { ImportStudentsForm } from "./import-form";

export const metadata: Metadata = { title: "Excel'den öğrenci aktar" };

export default async function ImportStudentsPage() {
  await requireCenter("students.edit");
  return (
    <>
      <PageHeader title="Excel'den öğrenci aktar" description="Elinizdeki öğrenci listesini tek seferde panele alın." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Dosya yükle" description="Excel (.xlsx) ya da CSV. İlk satır başlık olmalı." />
          <CardBody>
            <ImportStudentsForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Nasıl hazırlanır?" />
          <CardBody className="space-y-3 text-sm text-slate-700">
            <a href="/api/kurum/disa-aktar/ogrenci-sablonu" download className={buttonClasses("outline", "sm")}>
              <Download className="size-4" aria-hidden /> Örnek şablonu indir (.xlsx)
            </a>
            <p>Sütun adları esnek okunur; kendi listenizi de yükleyebilirsiniz. Tanınan başlıklar:</p>
            <p className="rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed">{STUDENT_TEMPLATE_HEADERS.join(" · ")}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>“Ad Soyad” tek sütunda olabilir; son kelime soyad sayılır.</li>
              <li>Öğrenci no kurumda varsa o öğrencinin bilgileri güncellenir, yoksa yeni öğrenci açılır.</li>
              <li>“Grup” sütunundaki sınıf yoksa otomatik açılır ve öğrenci eklenir.</li>
              <li>Telefonlar 05XX biçimine çevrilir; hatalı satırlar sonuçta listelenir.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

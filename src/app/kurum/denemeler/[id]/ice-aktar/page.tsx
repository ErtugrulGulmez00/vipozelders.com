import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { getExamOrThrow } from "@/server/center/exams";
import { CenterError } from "@/server/center/errors";
import { db } from "@/server/db";
import { ExamImportForm } from "../../exam-forms";
import { ExamHeader } from "../exam-header";

export const metadata: Metadata = { title: "Sonuçları Excel'den aktar" };

export default async function ExamImportPage({ params }: PageProps<"/kurum/denemeler/[id]/ice-aktar">) {
  const ctx = await requireCenter("exams.manage");
  const { id } = await params;
  const exam = await getExamOrThrow(ctx, id).catch((error) => {
    if (error instanceof CenterError) notFound();
    throw error;
  });
  const groups = await db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const hasKeys = exam.sections.every((s) => s.answerKey);
  const template = (extra: string) => `/api/kurum/disa-aktar/deneme-sablonu?deneme=${exam.id}${extra}`;
  return (
    <>
      <ExamHeader exam={exam} active="aktar" />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Dosya yükle" description="Excel (.xlsx) ya da CSV; ilk satır başlık" />
          <CardBody>
            <ExamImportForm examId={exam.id} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Şablon" description="Öğrenci listeniz hazır gelir; sadece sayıları doldurun." />
          <CardBody className="space-y-4 text-sm text-slate-700">
            <div className="flex flex-wrap gap-2">
              <a href={template("")} download className={buttonClasses("outline", "sm")}>
                <Download className="size-4" aria-hidden /> Doğru/yanlış şablonu
              </a>
              {hasKeys ? (
                <a href={template("&tip=cevap")} download className={buttonClasses("outline", "sm")}>
                  <Download className="size-4" aria-hidden /> Cevap şablonu
                </a>
              ) : null}
            </div>
            {groups.length ? (
              <p className="text-xs text-slate-500">
                Sınıfa göre şablon:{" "}
                {groups.map((g, i) => (
                  <span key={g.id}>
                    {i ? " · " : ""}
                    <a href={template(`&grup=${g.id}`)} download className="font-semibold text-brand-700 hover:underline">
                      {g.name}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-5">
              <li>Öğrenciler “Öğrenci No” ile, yoksa “Ad Soyad” ile eşleşir.</li>
              <li>Her ders için “{exam.sections[0]?.name} D” ve “{exam.sections[0]?.name} Y” sütunları ya da “{exam.sections[0]?.name} Cevap” sütunu kullanılır.</li>
              <li>İsteğe bağlı “Puan” sütunu yayınevinin puanını kaydeder.</li>
              <li>Aynı öğrenci yeniden aktarılırsa sonucu güncellenir; net ve sıralama otomatik hesaplanır.</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

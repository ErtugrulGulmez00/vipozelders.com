import { FileUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { DeleteExamButton } from "@/components/koc/koc-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { PdfUploadForm } from "@/app/kurum/denemeler/pdf-aktar/pdf-forms";
import { EXAM_PRESETS, formatNet, type ExamKindName } from "@/lib/center/exams";
import { dbDateToString } from "@/lib/dates";
import { coachFeatureOpen } from "@/lib/pi-koc";
import { LockedFeature } from "@/components/koc/locked-feature";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Denemeler" };

const dmy = (d: string) => d.split("-").reverse().join(".");

/** Pi Koç denemeleri: yayınevi sonuç PDF'inden toplu aktarım ve bütün denemelerin listesi. */
export default async function KocExamsPage({ searchParams }: PageProps<"/koc/denemeler">) {
  const ctx = await requireCenter("exams.manage");
  const sp = await searchParams;
  const locked = !coachFeatureOpen(ctx.coach, "pdfImport");
  const exams = await db.centerExam.findMany({
    where: { centerId: ctx.center.id },
    orderBy: { date: "desc" },
    take: 60,
    include: { results: { select: { net: true, student: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { net: "desc" } } },
  });
  return (
    <>
      <PageHeader title="Denemeler" description={locked ? "Öğrencilerinizin deneme sonuçlarını öğrenci sayfasındaki Denemeler sekmesinden girersiniz; net grafiği kendiliğinden çıkar." : "Yayınevinin sonuç PDF'ini yükleyin; öğrencilerinizin netleri, cevapları ve konu analizi kendiliğinden girilir. Tek öğrencinin sonucunu öğrenci sayfasından da girebilirsiniz."} />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        {locked ? (
          <LockedFeature feature="pdfImport" />
        ) : (
        <Card>
          <CardHeader title="Yayınevi PDF'inden aktar" description="En fazla 25 MB" />
          <CardBody className="space-y-4">
            <PdfUploadForm />
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
              <li>PDF okunur: her öğrencinin doğru, yanlış, net, puan ve cevapları alınır.</li>
              <li>PDF’teki adlar öğrencilerinizle eşleştirilir; emin olunamayanları siz seçersiniz, seçimleriniz hatırlanır.</li>
              <li>Onaylayınca sonuçlar öğrenci sayfalarına, grafiklere ve öğrenci ekranına düşer.</li>
            </ol>
          </CardBody>
        </Card>
        )}
        {exams.length ? (
          <div className="space-y-3">
            {exams.map((e) => (
              <Card key={e.id}>
                <div className="flex items-start justify-between gap-3 px-5 pt-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{e.name}</p>
                    <p className="text-xs text-slate-500">
                      {EXAM_PRESETS[e.kind as ExamKindName].label} · {dmy(dbDateToString(e.date))}
                      {e.publisher ? ` · ${e.publisher}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone="brand">{e.results.length} öğrenci</Badge>
                    <DeleteExamButton examId={e.id} />
                  </div>
                </div>
                <CardBody className="flex flex-wrap gap-1.5 pt-3">
                  {e.results.map((r) => (
                    <Link key={r.student.id} href={`/koc/ogrenciler/${r.student.id}?sekme=denemeler`} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-brand-50">
                      {r.student.firstName} {r.student.lastName} <b className="text-ink-900">{formatNet(r.net)}</b>
                    </Link>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={<FileUp className="size-8" />} title="Henüz deneme yok" description="Yayınevi PDF'ini yükleyin ya da öğrenci sayfasından tek tek sonuç girin." />
        )}
      </div>
    </>
  );
}

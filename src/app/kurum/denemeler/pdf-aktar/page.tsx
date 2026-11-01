import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { PdfUploadForm } from "./pdf-forms";

export const metadata: Metadata = { title: "Yayınevi PDF'inden aktar" };

export default async function ExamPdfUploadPage() {
  await requireCenter("exams.manage");
  return (
    <>
      <Link href="/kurum/denemeler" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Denemeler
      </Link>
      <PageHeader title="Yayınevi PDF'inden aktar" description="Yayınevinin sonuç sisteminden indirdiğiniz PDF’i yükleyin; deneme, cevap anahtarı, kazanımlar ve öğrenci sonuçları otomatik oluşur." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Sonuç PDF’i" description="En fazla 25 MB" />
          <CardBody>
            <PdfUploadForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Nasıl çalışır?" />
          <CardBody>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>PDF okunur: her öğrencinin “Sonuç Belgesi” sayfasından doğru, yanlış, net, puan, sıralamalar ve cevaplar alınır.</li>
              <li>Deneme kendiliğinden oluşur: dersler, soru sayıları, cevap anahtarı ve soru başına kazanımlar. A/B kitapçıkları ayrı ayrı okunur.</li>
              <li>PDF’teki öğrenciler kurumunuzdaki öğrencilerle eşleştirilir. Emin olunamayanları siz seçersiniz; seçimleriniz sonraki PDF’lerde hatırlanır.</li>
              <li>Onaylayınca sonuçlar kaydedilir. Kontrol ettikten sonra “Velilere yayınla” ile öğrenci ve veli hesaplarına açılır.</li>
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Bir PDF’te birden fazla deneme varsa (ör. 5. ve 8. sınıf) ayrı denemeler olarak aktarılır. Raporunuz tanınmazsa PDF’i bize iletin, biçimi ekleyelim; bu arada Excel ile aktarabilirsiniz.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

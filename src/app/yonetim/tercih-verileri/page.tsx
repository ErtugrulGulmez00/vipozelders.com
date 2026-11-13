import type { Metadata } from "next";
import { connection } from "next/server";
import { DeletePlacementYearForm, ImportPlacementForm } from "@/components/placement/placement-forms";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { PLACEMENT_EXAMS } from "@/lib/placement";
import { requireRole } from "@/server/auth/current-user";
import { programYears } from "@/server/placement";

export const metadata: Metadata = { title: "Tercih robotu verileri" };

/** LGS / YKS taban puan tablolarının yüklenmesi (tercih robotu bu veriyle çalışır). */
export default async function PlacementDataPage() {
  await requireRole("ADMIN");
  await connection();
  const years = await programYears();
  const thisYear = new Date().getFullYear();
  return (
    <>
      <PageHeader title="Tercih robotu verileri" description="Kurum panelindeki ve Pi Koç'taki LGS / YKS tercih robotları en son yüklenen yılın verisini kullanır." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Tablo yükle" description="Aynı sınav ve yıl yeniden yüklenirse kayıtlar program koduna göre güncellenir; öğrencilerin tercih listeleri bozulmaz." />
          <CardBody>
            <ImportPlacementForm defaultYear={thisYear} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tanınan sütunlar" />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <p>
              <strong className="text-ink-900">YKS</strong> (YÖK Atlas “Tercih Sihirbazı” Excel çıktısı olduğu gibi yüklenebilir): Program Kodu, Üniversite Adı, Fakülte, Program Adı, İl, Puan Türü, Üniversite Türü, Burs / Öğretim Türü, Kontenjan, Yerleşen, Taban Puan,
              Taban Başarı Sırası, Tavan Puan.
            </p>
            <p>
              <strong className="text-ink-900">LGS</strong>: Kurum Kodu, Okul Adı, İl, İlçe, Okul Türü, Pansiyon / Yabancı Dil, Kontenjan, Taban Puan, Yüzdelik Dilim.
            </p>
            <p>Zorunlu: ad ve il; YKS&apos;de puan türü ve (taban puan ya da başarı sırası), LGS&apos;de taban puan ya da yüzdelik dilim. Başlık satırı ilk 15 satırda aranır; sayılar Türkçe biçimde (452,123 · 12.345) okunur.</p>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Yüklü veriler" />
        {years.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Sınav</Th>
                <Th>Yıl</Th>
                <Th className="text-right">Kayıt</Th>
                <Th>Son yükleme</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {years.map((y) => (
                <tr key={`${y.exam}-${y.year}`}>
                  <Td className="font-semibold">{PLACEMENT_EXAMS[y.exam].label}</Td>
                  <Td>{y.year}</Td>
                  <Td className="text-right tabular-nums">{y.count.toLocaleString("tr-TR")}</Td>
                  <Td>{y.updatedAt ? formatDate(y.updatedAt) : "—"}</Td>
                  <Td className="text-right">
                    <DeletePlacementYearForm exam={y.exam} year={y.year} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <EmptyState title="Henüz veri yok" description="Robotlar veri yüklenene kadar “veri henüz yüklenmedi” der." />
          </CardBody>
        )}
      </Card>
    </>
  );
}

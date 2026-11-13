import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PrintButton } from "@/components/center/center-client";
import { ReportNoteForm, SendReportButton } from "@/components/koc/koc-forms";
import { WeeklyReport } from "@/components/koc/weekly-report";
import { CopyButton } from "@/components/ui/copy-button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { addDaysToDateString, formatCompact, formatDate, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { aiConfigured } from "@/server/ai";
import { appUrl } from "@/server/email";
import { freeAiLeft, getReport, reportWeek, weeklyReportData } from "@/server/koc-report";
import { LockedFeature } from "@/components/koc/locked-feature";
import { coachFeatureOpen } from "@/lib/pi-koc";
import { toWhatsAppNumber } from "@/server/whatsapp";

export const metadata: Metadata = { title: "Haftalık rapor" };

const dm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;

export default async function KocReportPage({ params, searchParams }: PageProps<"/koc/ogrenciler/[id]/rapor">) {
  await connection();
  const ctx = await requireCenter();
  const { id } = await params;
  const sp = await searchParams;
  const student = await db.centerStudent.findFirst({ where: { id, centerId: ctx.center.id }, include: { guardians: { where: { isStudentAccount: false }, orderBy: { isPrimary: "desc" } } } });
  if (!student) notFound();
  const today = toLocalDateString(new Date());
  const weekStart = reportWeek(sp.hafta, today);
  const [data, report, aiLeft] = await Promise.all([weeklyReportData(ctx.center.id, id, weekStart), getReport(id, weekStart), freeAiLeft(ctx)]);
  const paid = coachFeatureOpen(ctx.coach, "autoReport");
  const base = `/koc/ogrenciler/${id}/rapor`;
  const nextWeek = addDaysToDateString(weekStart, 7);
  const url = report ? appUrl(`/rapor/${report.token}`) : null;
  const phone = student.guardians.map((g) => (g.phone ? toWhatsAppNumber(g.phone) : null)).find(Boolean) ?? null;
  const waText = url ? `Merhaba, ${student.firstName} için ${dm(weekStart)} haftasının koçluk raporu: ${url}` : "";
  const waHref = url ? `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(waText)}` : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/koc/ogrenciler/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-ink-900">
            <ChevronLeft className="size-4" aria-hidden /> {student.firstName} {student.lastName}
          </Link>
          <div className="flex items-center gap-1">
            <Link href={`${base}?hafta=${addDaysToDateString(weekStart, -7)}`} className="inline-flex size-9 items-center justify-center rounded-xl ring-1 ring-slate-200 hover:bg-white" aria-label="Önceki hafta">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <span className="px-2 text-sm font-semibold text-ink-900">
              {dm(weekStart)} – {dm(addDaysToDateString(weekStart, 6))}
            </span>
            {nextWeek <= today ? (
              <Link href={`${base}?hafta=${nextWeek}`} className="inline-flex size-9 items-center justify-center rounded-xl ring-1 ring-slate-200 hover:bg-white" aria-label="Sonraki hafta">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="size-9" />
            )}
          </div>
        </div>
        <WeeklyReport data={data} note={report?.note ?? null} branded={!paid} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 print:hidden">
        <Card>
          <CardHeader title="Değerlendirmeniz" />
          <CardBody>
            <ReportNoteForm studentId={id} weekStart={weekStart} note={report?.note ?? null} aiEnabled={aiConfigured() && aiLeft !== 0} />
            {aiLeft !== null && aiConfigured() ? (
              <p className="mt-2 text-xs text-slate-500">{aiLeft ? `Ücretsiz pakette bu ay ${aiLeft} yapay zekâ taslağı hakkınız var.` : "Ücretsiz paketteki bu ayki yapay zekâ hakkınız kullanıldı; taslak verilerden yazılır."}</p>
            ) : null}
          </CardBody>
        </Card>
        {paid ? (
          <p className="px-1 text-xs text-slate-500">{ctx.center.name} adıyla gider; Pi Koç imzası olmaz. Otomatik gönderimi Hesap sayfasından açarsınız.</p>
        ) : (
          <LockedFeature feature="autoReport" compact />
        )}
        <Card>
          <CardHeader title="Veliyle paylaş" description={url ? `Bağlantı ${report ? formatDate(report.expiresAt) : ""} tarihine kadar açık.` : "Değerlendirmeyi kaydedince ya da gönderince bağlantı oluşur."} />
          <CardBody className="space-y-3">
            <SendReportButton studentId={id} weekStart={weekStart} sentAt={report?.sentAt ? formatCompact(report.sentAt) : null} />
            {url && waHref ? (
              <>
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-bold text-white hover:brightness-95">
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp&apos;ta paylaş
                </a>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CopyButton value={url} label="Bağlantıyı kopyala" />
                  <PrintButton />
                </div>
              </>
            ) : (
              <PrintButton />
            )}
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

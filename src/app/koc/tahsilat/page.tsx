import { ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BarChart } from "@/components/koc/charts";
import { PaymentControls } from "@/components/koc/koc-tools";
import { StudentAvatar } from "@/components/koc/student-card";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { coachFeeOverview, isPeriod, periodLabel, shiftPeriod } from "@/server/koc-extra";

export const metadata: Metadata = { title: "Tahsilat" };

/** Koçun kendi tahsilatı: öğrenci başına aylık ücret, ödendi/bekliyor ve son 6 ay. */
export default async function KocFeesPage({ searchParams }: PageProps<"/koc/tahsilat">) {
  await connection();
  const ctx = await requireCenter("students.edit");
  const sp = await searchParams;
  const current = toLocalDateString(new Date()).slice(0, 7);
  const period = isPeriod(sp.ay) ? sp.ay : current;
  const data = await coachFeeOverview(ctx.center.id, period);
  const paidCount = data.rows.filter((r) => r.payment).length;
  return (
    <>
      <PageHeader
        title="Tahsilat"
        description="Öğrencilerinizden aldığınız aylık ücretin takibi. Yalnızca siz görürsünüz."
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/koc/tahsilat?ay=${shiftPeriod(period, -1)}`} className="inline-flex size-9 items-center justify-center rounded-xl ring-1 ring-slate-200 hover:bg-white" aria-label="Önceki ay">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
            <span className="min-w-28 px-2 text-center text-sm font-semibold text-ink-900">{periodLabel(period)}</span>
            {period < current ? (
              <Link href={`/koc/tahsilat?ay=${shiftPeriod(period, 1)}`} className="inline-flex size-9 items-center justify-center rounded-xl ring-1 ring-slate-200 hover:bg-white" aria-label="Sonraki ay">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span className="size-9" />
            )}
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Beklenen" value={formatMoney(data.expected)} hint={`${data.rows.length - data.missingFee} öğrencinin aylık ücreti`} />
        <Kpi label="Tahsil edilen" value={formatMoney(data.collected)} hint={`${paidCount} ödeme`} good />
        <Kpi label="Kalan" value={formatMoney(data.outstanding)} hint={data.outstanding ? "Ödemesi bekleyenler aşağıda" : "Bu ay bekleyen ödeme yok"} />
      </div>
      {data.missingFee ? (
        <Alert tone="info" className="mb-6">
          {data.missingFee} öğrencinin aylık ücreti girilmemiş. Öğrenci sayfasında Bilgiler sekmesinden ekleyebilir ya da aşağıdaki tutarı elle yazıp “Ödendi” diyebilirsiniz.
        </Alert>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Card>
          <CardHeader title={`${periodLabel(period)} ödemeleri`} />
          {data.rows.length ? (
            <ul className="divide-y divide-slate-100">
              {data.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <StudentAvatar id={r.id} firstName={r.firstName} lastName={r.lastName} />
                  <span className="min-w-0 flex-1">
                    <Link href={`/koc/ogrenciler/${r.id}?sekme=bilgiler`} className="block truncate text-sm font-semibold text-ink-900 hover:text-brand-700">
                      {r.firstName} {r.lastName}
                    </Link>
                    <span className="text-xs text-slate-500">{r.monthlyFee ? `Aylık ${formatMoney(r.monthlyFee)}` : "Aylık ücret girilmedi"}</span>
                  </span>
                  {r.payment ? (
                    <span className="flex items-center gap-2">
                      <Badge tone="green">
                        Ödendi · {formatMoney(r.payment.amount)}
                        {r.payment.method ? ` · ${r.payment.method}` : ""}
                      </Badge>
                      <span className="hidden text-xs text-slate-500 sm:inline">{formatDate(r.payment.paidAt)}</span>
                      <PaymentControls studentId={r.id} period={period} fee="" payment={{ id: r.payment.id }} />
                    </span>
                  ) : (
                    <PaymentControls studentId={r.id} period={period} fee={r.monthlyFee ? String(r.monthlyFee / 100) : ""} payment={null} />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <EmptyState icon={<Wallet className="size-8" />} title="Öğrenciniz yok" description="Öğrenci ekleyince aylık ücret takibi burada görünür." />
            </CardBody>
          )}
        </Card>
        <Card>
          <CardHeader title="Son 6 ay" description="Tahsil edilen toplam" />
          <CardBody>
            <BarChart label="Aylık tahsilat (TL)" unit="TL" height={190} bars={data.months.map((m) => ({ label: periodLabel(m.period).slice(0, 3), value: Math.round(m.amount / 100), hint: periodLabel(m.period) }))} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, hint, good }: { label: string; value: string; hint: string; good?: boolean }) {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-4 shadow-xs sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={good ? "mt-2 font-display text-2xl font-extrabold text-emerald-700 sm:text-3xl" : "mt-2 font-display text-2xl font-extrabold text-ink-900 sm:text-3xl"}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

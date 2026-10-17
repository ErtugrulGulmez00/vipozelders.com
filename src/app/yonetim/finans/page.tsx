import { FileSpreadsheet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact, formatDate, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { PAYMENT_STATUS, REFUND_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/payments/service";
import { nextPayoutDay, parsePayoutDays } from "@/server/pricing";
import { loadSettings } from "@/server/settings";
import { PayoutRecordForm } from "../ogretmenler/[id]/admin-forms";
import { RetryRefundButton } from "../randevular/[id]/booking-admin-forms";

export const metadata: Metadata = { title: "Finans" };

export default async function FinancePage() {
  await requireRole("ADMIN");
  const [totals, refunds, refundIssues, balanceGroups, payments, pendingTotal] = await Promise.all([
    db.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { amount: true } }),
    db.refund.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
    db.refund.findMany({ where: { status: { in: ["PENDING", "FAILED"] } }, include: { payment: { include: { booking: true, creditPurchase: true } } }, orderBy: { createdAt: "asc" } }),
    db.ledgerEntry.groupBy({ by: ["teacherId"], where: { bucket: "AVAILABLE" }, _sum: { amount: true } }),
    db.payment.findMany({ where: { status: { not: "INITIATED" } }, orderBy: { createdAt: "desc" }, take: 30, include: { booking: true, creditPurchase: true } }),
    db.ledgerEntry.aggregate({ where: { bucket: "PENDING" }, _sum: { amount: true } }),
  ]);
  const withBalance = balanceGroups.filter((g) => (g._sum.amount ?? 0) > 0);
  const settings = await loadSettings();
  const today = toLocalDateString(new Date());
  const nextPayout = nextPayoutDay(today, parsePayoutDays(settings.payoutDays));
  const payableTotal = withBalance.reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);
  const teachers = await db.teacherProfile.findMany({
    where: { userId: { in: withBalance.map((g) => g.teacherId) } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  const provider = getPaymentProvider();
  const commission = await db.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { commissionAmount: true } });

  return (
    <>
      <PageHeader
        title="Finans"
        description="Tahsilatlar, iadeler ve öğretmen hakedişleri."
        actions={
          <>
            <a href="/api/yonetim/disa-aktar/odemeler" className={buttonClasses("outline", "sm")} download>
              <FileSpreadsheet className="size-4" aria-hidden /> Ödemeler (Excel)
            </a>
            <a href="/api/yonetim/disa-aktar/hakedisler" className={buttonClasses("outline", "sm")} download>
              <FileSpreadsheet className="size-4" aria-hidden /> Hakediş ödemeleri (Excel)
            </a>
          </>
        }
      />
      {nextPayout ? (
        <Alert tone={nextPayout === today ? "warning" : "info"} className="mb-6" title={nextPayout === today ? "Bugün öğretmen ödeme günü" : `Sonraki öğretmen ödeme günü: ${formatDate(zonedDateTime(nextPayout, 12 * 60))}`}>
          {withBalance.length
            ? `${withBalance.length} öğretmenin ödenebilir bakiyesi var, toplam ${formatMoney(payableTotal)}. Havaleyi yapıp aşağıdan kaydedin.`
            : "Şu an ödenebilir bakiyesi olan öğretmen yok."}
        </Alert>
      ) : null}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Toplam tahsilat" value={formatMoney(totals._sum.amount ?? 0)} />
        <StatCard label="Toplam iade" value={formatMoney(refunds._sum.amount ?? 0)} />
        <StatCard label="Komisyon (tamamlanan dersler)" value={formatMoney(commission._sum.commissionAmount ?? 0)} />
        <StatCard label="Öğretmenlerde bekleyen" value={formatMoney(pendingTotal._sum.amount ?? 0)} hint="Henüz serbest kalmamış hakedişler" />
      </div>

      {refundIssues.length ? (
        <Card className="mb-6">
          <CardHeader title="Bekleyen / başarısız iadeler" />
          <Table>
            <thead>
              <tr>
                <Th>Randevu</Th>
                <Th>Tutar</Th>
                <Th>Durum</Th>
                <Th>Hata</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {refundIssues.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <PaymentLink booking={r.payment.booking} purchase={r.payment.creditPurchase} />
                  </Td>
                  <Td>{formatMoney(r.amount)}</Td>
                  <Td>
                    <Badge tone={REFUND_STATUS[r.status].tone}>{REFUND_STATUS[r.status].label}</Badge>
                  </Td>
                  <Td className="text-xs text-rose-600">{r.error ?? "—"}</Td>
                  <Td>{r.status === "FAILED" ? <RetryRefundButton refundId={r.id} /> : null}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader title="Ödenecek hakedişler" description={provider.automaticPayouts ? "Pazaryeri modunda ödeme kuruluşu öğretmenlere otomatik öder." : "Havaleyi yaptıktan sonra buraya kaydedin; öğretmene bildirim gider."} />
        <CardBody>
          {withBalance.length === 0 ? <p className="text-sm text-slate-500">Ödenecek serbest bakiye yok.</p> : null}
          <div className="divide-y divide-slate-100">
            {withBalance.map((g) => {
              const t = teachers.find((x) => x.userId === g.teacherId);
              const amount = g._sum.amount ?? 0;
              return (
                <div key={g.teacherId} className="grid gap-4 py-4 lg:grid-cols-[1fr_420px]">
                  <div className="text-sm">
                    <Link href={`/yonetim/ogretmenler/${g.teacherId}?bolum=finans`} className="font-semibold text-brand-700 hover:underline">
                      {t?.user.firstName} {t?.user.lastName}
                    </Link>
                    <p className="mt-1 text-slate-600">
                      Ödenebilir: <strong>{formatMoney(amount)}</strong>
                    </p>
                    <p className="text-xs text-slate-500">
                      {t?.payoutIban ? `${t.payoutLegalName ?? ""} · ${t.payoutIban}` : <span className="text-rose-600">IBAN girilmemiş</span>}
                    </p>
                  </div>
                  <PayoutRecordForm teacherId={g.teacherId} available={String(amount / 100)} />
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Son ödemeler" />
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Randevu</Th>
              <Th>Sağlayıcı</Th>
              <Th>Tutar</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-xs">{formatCompact(p.createdAt)}</Td>
                <Td>
                  <PaymentLink booking={p.booking} purchase={p.creditPurchase} />
                </Td>
                <Td className="text-xs">{p.provider}</Td>
                <Td>{formatMoney(p.amount)}</Td>
                <Td>
                  <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {provider.id === "mock" ? (
        <Alert tone="info" className="mt-6">
          Ödemeler test sağlayıcısıyla alınıyor. Canlıya geçerken .env dosyasında PAYMENT_PROVIDER=paytr ve PayTR mağaza bilgilerini (PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT) girin.
        </Alert>
      ) : null}
    </>
  );
}

function PaymentLink({ booking, purchase }: { booking: { id: string; code: string } | null; purchase: { code: string; credits: number } | null }) {
  if (booking) {
    return (
      <Link href={`/yonetim/randevular/${booking.id}`} className="font-semibold text-brand-700 hover:underline">
        {booking.code}
      </Link>
    );
  }
  if (purchase) {
    return (
      <Link href={`/yonetim/soru-havuzu?paket=${purchase.code}`} className="font-semibold text-brand-700 hover:underline">
        {purchase.code} <span className="font-normal text-slate-500">· {purchase.credits} kredi</span>
      </Link>
    );
  }
  return <>—</>;
}

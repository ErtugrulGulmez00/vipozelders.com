import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { PAYMENT_STATUS, REFUND_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Ödemelerim" };

export default async function PaymentsPage() {
  const user = await requireRole("STUDENT");
  const payments = await db.payment.findMany({
    where: { booking: { studentId: user.id }, status: { not: "INITIATED" } },
    include: { booking: true, refunds: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Ödemelerim" description="Kartınızdan yapılan tahsilatlar ve iadeler." />
      {payments.length === 0 ? (
        <EmptyState icon={<CreditCard className="size-8" />} title="Henüz ödeme yok" />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th>Ders</Th>
                <Th>Tutar</Th>
                <Th>Durum</Th>
                <Th>İade</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <Td className="whitespace-nowrap">{formatCompact(p.createdAt)}</Td>
                  <Td>
                    <Link href={`/hesabim/derslerim/${p.bookingId}`} className="font-medium text-brand-700 hover:underline">
                      {p.booking.levelName} {p.booking.subjectName}
                    </Link>
                    <p className="text-xs text-slate-400">{p.booking.code}</p>
                  </Td>
                  <Td className="font-semibold">{formatMoney(p.amount)}</Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </Td>
                  <Td>
                    {p.refunds.length
                      ? p.refunds.map((r) => (
                          <p key={r.id} className="text-xs">
                            {formatMoney(r.amount)} · <span className={r.status === "FAILED" ? "text-rose-600" : ""}>{REFUND_STATUS[r.status].label}</span>
                          </p>
                        ))
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}

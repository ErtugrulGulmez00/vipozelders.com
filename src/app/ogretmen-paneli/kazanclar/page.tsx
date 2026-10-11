import { Clock, Landmark, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PayoutForm } from "@/components/teacher/payout-form";
import { Alert, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { decryptText, maskIdentityNumber } from "@/server/crypto";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { getPaymentProvider } from "@/server/payments/service";

export const metadata: Metadata = { title: "Kazançlarım" };

const BUCKET_LABEL = { PENDING: "Bekleyen", AVAILABLE: "Ödenebilir", PAID: "Ödendi" } as const;

export default async function EarningsPage() {
  const user = await requireRole("TEACHER");
  const [teacher, balances, entries, payouts] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    teacherBalances(user.id),
    db.ledgerEntry.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.payout.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const automatic = getPaymentProvider().automaticPayouts;
  let maskedIdentity: string | null = null;
  if (teacher.payoutIdentityNumberEnc) {
    try {
      maskedIdentity = maskIdentityNumber(decryptText(teacher.payoutIdentityNumberEnc));
    } catch {
      maskedIdentity = "***";
    }
  }

  return (
    <>
      <PageHeader title="Kazançlarım" description="Ders ücretleri, ders tamamlanıp itiraz süresi dolduktan sonra ödenebilir bakiyenize geçer." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Bekleyen" value={formatMoney(balances.pending)} hint="Onaylı/tamamlanan, henüz serbest kalmamış dersler" icon={<Clock className="size-5" />} />
        <StatCard label="Ödenebilir bakiye" value={formatMoney(balances.available)} hint={automatic ? "Ödeme kuruluşu otomatik aktarır" : "Yönetici haftalık olarak havale eder"} icon={<Wallet className="size-5" />} />
        <StatCard label="Toplam ödenen" value={formatMoney(balances.paid)} icon={<Landmark className="size-5" />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Hareketler" />
          {entries.length === 0 ? (
            <CardBody>
              <EmptyState title="Henüz hareket yok" description="İlk dersinizi onayladığınızda burada görünecek." />
            </CardBody>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tarih</Th>
                  <Th>Açıklama</Th>
                  <Th>Kova</Th>
                  <Th className="text-right">Tutar</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-xs">{formatCompact(e.createdAt)}</Td>
                    <Td>{e.description}</Td>
                    <Td className="text-xs">{BUCKET_LABEL[e.bucket]}</Td>
                    <Td className={`text-right font-semibold ${e.amount < 0 ? "text-slate-400" : "text-emerald-700"}`}>{formatMoney(e.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {payouts.length ? (
            <CardBody className="border-t border-slate-100">
              <p className="mb-2 text-sm font-semibold text-slate-800">Ödemeler</p>
              <ul className="space-y-1 text-sm">
                {payouts.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {formatCompact(p.createdAt)} · {p.method === "MANUAL_TRANSFER" ? "Havale" : "Ödeme kuruluşu"} {p.reference ? `(${p.reference})` : ""}
                    </span>
                    <strong>{formatMoney(p.amount)}</strong>
                  </li>
                ))}
              </ul>
            </CardBody>
          ) : null}
        </Card>
        <Card>
          <CardHeader title="Ödeme bilgileri" description="Hakedişlerinizin gönderileceği hesap." />
          <CardBody>
            {!teacher.payoutIban ? <Alert tone="warning" className="mb-4">Ödeme alabilmek için IBAN bilginizi girin.</Alert> : null}
            <PayoutForm teacherId={user.id} legalName={teacher.payoutLegalName ?? `${user.firstName} ${user.lastName}`} iban={teacher.payoutIban ?? ""} maskedIdentity={maskedIdentity} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

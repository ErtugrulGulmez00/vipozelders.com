import { Coins } from "lucide-react";
import type { Metadata } from "next";
import { RefundCreditsForm } from "@/components/panel/pool-forms";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact, formatDate } from "@/lib/dates";
import { CREDIT_ENTRY_KIND, CREDIT_PURCHASE_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { creditLots, refundPreview } from "@/server/credits";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { SectionTabs, STUDENT_QUESTION_TABS } from "@/components/panel/section-tabs";

export const metadata: Metadata = { title: "Soru kredilerim" };

export default async function CreditsPage() {
  const user = await requireRole("STUDENT");
  const now = new Date();
  const [settings, lots, entries, purchases] = await Promise.all([
    loadSettings(),
    creditLots(user.id, undefined, now),
    db.creditLedger.findMany({ where: { studentId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { question: { select: { code: true } } } }),
    db.creditPurchase.findMany({ where: { studentId: user.id, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const balance = lots.filter((l) => !l.expired).reduce((sum, l) => sum + Math.max(0, l.remaining), 0);
  const previews = new Map(await Promise.all(purchases.map(async (p) => [p.id, await refundPreview(p, settings, now)] as const)));
  const remaining = new Map(lots.map((l) => [l.id, l.remaining]));

  return (
    <>
      <SectionTabs tabs={STUDENT_QUESTION_TABS} active="/hesabim/krediler" />
      <PageHeader
        title="Soru kredilerim"
        description={`Kalan krediniz: ${balance}. Her soru 1 kredi; krediler ${settings.creditValidityMonths} ay geçerlidir ve önce süresi en erken dolan paketten düşülür.`}
        actions={<LinkButton href="/soru-sor">Kredi al / soru sor</LinkButton>}
      />
      {purchases.length === 0 ? (
        <EmptyState icon={<Coins className="size-8" />} title="Henüz kredi paketiniz yok" action={<LinkButton href="/soru-sor">Paketleri gör</LinkButton>} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Paketlerim"
              description={`Satın almadan sonraki ${settings.creditRefundDays} gün içinde kullanılmayan kredilerin iadesini isteyebilirsiniz; kullanılan krediler tek soru fiyatından düşülür.`}
            />
            <Table>
              <thead>
                <tr>
                  <Th>Paket</Th>
                  <Th>Tutar</Th>
                  <Th>Kalan</Th>
                  <Th>Son kullanma</Th>
                  <Th>Durum</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => {
                  const preview = previews.get(p.id);
                  const status = CREDIT_PURCHASE_STATUS[p.status];
                  const expired = Boolean(p.expiresAt && p.expiresAt <= now);
                  return (
                    <tr key={p.id}>
                      <Td>
                        <p className="font-medium text-slate-900">{p.credits} soru kredisi</p>
                        <p className="text-xs text-slate-400">
                          {p.code} · {p.paidAt ? formatCompact(p.paidAt) : "—"}
                        </p>
                      </Td>
                      <Td>
                        {formatMoney(p.price)}
                        {p.refundedAmount > 0 ? <p className="text-xs text-sky-700">{formatMoney(p.refundedAmount)} iade</p> : null}
                      </Td>
                      <Td className="font-semibold">{Math.max(0, remaining.get(p.id) ?? 0)}</Td>
                      <Td className="whitespace-nowrap">{p.expiresAt ? formatDate(p.expiresAt) : "—"}</Td>
                      <Td>
                        <Badge tone={expired ? "slate" : status?.tone}>{expired ? "Süresi doldu" : (status?.label ?? p.status)}</Badge>
                      </Td>
                      <Td className="text-right">
                        {preview?.allowed ? (
                          <RefundCreditsForm id={p.id} label={`${formatMoney(preview.amount)} iade iste`} />
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Kredi hareketleri" />
            <Table>
              <thead>
                <tr>
                  <Th>Tarih</Th>
                  <Th>İşlem</Th>
                  <Th>Kredi</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-xs">{formatCompact(e.createdAt)}</Td>
                    <Td>
                      {CREDIT_ENTRY_KIND[e.kind] ?? e.kind}
                      {e.note ? <p className="text-xs text-slate-400">{e.note}</p> : null}
                    </Td>
                    <Td className={e.amount > 0 ? "font-semibold text-emerald-700" : "font-semibold text-slate-700"}>
                      {e.amount > 0 ? `+${e.amount}` : e.amount}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}

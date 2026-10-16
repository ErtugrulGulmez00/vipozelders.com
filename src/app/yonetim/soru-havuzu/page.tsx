import { Coins, Inbox, MessageCircleQuestion, Scale } from "lucide-react";
import type { Metadata } from "next";
import { ResolvePoolDisputeForm } from "@/components/panel/pool-forms";
import { PoolQuestionView } from "@/components/panel/pool-question-view";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { CREDIT_PURCHASE_STATUS, POOL_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Soru havuzu" };

const name = (u: { firstName: string; lastName: string } | null | undefined) => (u ? `${u.firstName} ${u.lastName}` : "—");

export default async function AdminPoolPage({ searchParams }: PageProps<"/yonetim/soru-havuzu">) {
  const { paket } = await searchParams;
  const packageCode = typeof paket === "string" ? paket.trim() : "";
  const [disputes, waiting, solvedCount, sales, fees, questions, purchases] = await Promise.all([
    db.poolQuestion.findMany({ where: { status: "DISPUTED" }, orderBy: { disputedAt: "asc" }, include: { student: { select: { firstName: true, lastName: true } }, claimedBy: { select: { user: { select: { firstName: true, lastName: true } } } } } }),
    db.poolQuestion.count({ where: { status: { in: ["OPEN", "CLAIMED"] } } }),
    db.poolQuestion.count({ where: { status: { in: ["ANSWERED", "CLOSED"] } } }),
    db.creditPurchase.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _sum: { price: true, refundedAmount: true }, _count: true }),
    db.poolQuestion.aggregate({ where: { status: { in: ["ANSWERED", "CLOSED"] } }, _sum: { teacherFee: true } }),
    db.poolQuestion.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { claimedBy: { select: { user: { select: { firstName: true, lastName: true } } } } } }),
    db.creditPurchase.findMany({
      where: packageCode ? { code: packageCode } : { status: { not: "PENDING_PAYMENT" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { student: { select: { firstName: true, lastName: true, email: true } } },
    }),
  ]);
  const netSales = (sales._sum.price ?? 0) - (sales._sum.refundedAmount ?? 0);

  return (
    <>
      <PageHeader title="Soru havuzu" description="Kredi satışları, havuzdaki sorular ve çözümlere yapılan itirazlar." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bekleyen soru" value={waiting} icon={<Inbox className="size-5" />} />
        <StatCard label="Çözülen soru" value={solvedCount} icon={<MessageCircleQuestion className="size-5" />} />
        <StatCard label="Kredi satışı (net)" value={formatMoney(netSales)} hint={`${sales._count} paket`} icon={<Coins className="size-5" />} />
        <StatCard label="Öğretmen hakedişi" value={formatMoney(fees._sum.teacherFee ?? 0)} hint="Çözülen sorular" icon={<Scale className="size-5" />} />
      </div>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Açık itirazlar</h2>
        {disputes.length === 0 ? (
          <Card>
            <EmptyState title="Açık itiraz yok" />
          </Card>
        ) : (
          disputes.map((q) => (
            <div key={q.id} className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <PoolQuestionView question={q} viewer="admin" />
              <Card className="h-fit">
                <CardHeader title="Karar" description={`Öğrenci: ${name(q.student)} · Öğretmen: ${name(q.claimedBy?.user)}`} />
                <CardBody>
                  <ResolvePoolDisputeForm id={q.id} />
                </CardBody>
              </Card>
            </div>
          ))
        )}
      </section>

      <Card className="mb-8">
        <CardHeader title="Son sorular" />
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Soru</Th>
              <Th>Öğretmen</Th>
              <Th>Puan</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <Td className="whitespace-nowrap text-xs">{formatCompact(q.createdAt)}</Td>
                <Td>
                  {q.levelName} · {q.subjectName}
                  <p className="text-xs text-slate-400">{q.code}</p>
                </Td>
                <Td>{name(q.claimedBy?.user)}</Td>
                <Td>{q.rating ?? "—"}</Td>
                <Td>
                  <Badge tone={POOL_STATUS[q.status]?.tone}>{POOL_STATUS[q.status]?.label ?? q.status}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHeader title={packageCode ? `Paket ${packageCode}` : "Kredi paketi satışları"} />
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Paket</Th>
              <Th>Öğrenci / veli</Th>
              <Th>Tutar</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <Td className="whitespace-nowrap text-xs">{formatCompact(p.createdAt)}</Td>
                <Td>
                  {p.credits} kredi
                  <p className="text-xs text-slate-400">{p.code}</p>
                </Td>
                <Td>
                  {name(p.student)}
                  <p className="text-xs text-slate-400">{p.student.email}</p>
                </Td>
                <Td>
                  {formatMoney(p.price)}
                  {p.refundedAmount > 0 ? <p className="text-xs text-sky-700">{formatMoney(p.refundedAmount)} iade</p> : null}
                </Td>
                <Td>
                  <Badge tone={CREDIT_PURCHASE_STATUS[p.status]?.tone}>{CREDIT_PURCHASE_STATUS[p.status]?.label ?? p.status}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

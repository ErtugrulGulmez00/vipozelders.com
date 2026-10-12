import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { IncomeExpenseChart } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/center/labels";
import { addDaysToDateString, dateStringToDbDate, formatDate, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { financeOverview, monthlyFinance } from "@/server/center/finance";
import { db } from "@/server/db";
import { FinanceTabs } from "./finance-tabs";

export const metadata: Metadata = { title: "Muhasebe" };

export default async function FinancePage() {
  const ctx = await requireCenter("finance.view");
  const centerId = ctx.center.id;
  const today = toLocalDateString(new Date());
  const yearAgo = addDaysToDateString(today, -365);
  const [overview, months, recent, byMethod, byCategory] = await Promise.all([
    financeOverview(centerId),
    monthlyFinance(centerId, 12),
    db.centerPayment.findMany({ where: { centerId }, orderBy: { createdAt: "desc" }, take: 8, include: { student: { select: { firstName: true, lastName: true } } } }),
    db.centerPayment.groupBy({ by: ["method"], where: { centerId, cancelledAt: null, paidAt: { gte: dateStringToDbDate(yearAgo) } }, _sum: { amount: true } }),
    db.centerExpense.groupBy({ by: ["category"], where: { centerId, date: { gte: dateStringToDbDate(yearAgo) } }, _sum: { amount: true } }),
  ]);
  const income = months.reduce((t, m) => t + m.income, 0);
  const expense = months.reduce((t, m) => t + m.expense, 0);
  const collectionRate = overview.contracted ? overview.collected / overview.contracted : 0;
  return (
    <>
      <PageHeader
        title="Muhasebe"
        description="Öğrenci ödeme planları, tahsilatlar, gecikenler ve giderler"
        actions={
          <>
            <a href="/api/kurum/disa-aktar/tahsilatlar" download className={buttonClasses("ghost", "sm")}>
              <Download className="size-4" aria-hidden /> Tahsilatlar
            </a>
            <a href="/api/kurum/disa-aktar/borclar" download className={buttonClasses("ghost", "sm")}>
              <Download className="size-4" aria-hidden /> Borç listesi
            </a>
          </>
        }
      />
      <FinanceTabs ctx={ctx} active="ozet" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sözleşme toplamı" value={formatMoney(overview.contracted)} hint={`%${Math.round(collectionRate * 100)} tahsil edildi`} />
        <StatCard label="Tahsil edilen" value={formatMoney(overview.collected)} />
        <StatCard label="Kalan alacak" value={formatMoney(overview.remaining)} />
        <StatCard label="Geciken" value={<span className={overview.overdue ? "text-rose-600" : undefined}>{formatMoney(overview.overdue)}</span>} hint={<Link href="/kurum/muhasebe/gecikenler" className="font-semibold text-brand-700 hover:underline">Gecikenler →</Link>} />
        <StatCard label="Bu ay vadesi gelen" value={formatMoney(overview.dueThisMonth)} />
        <StatCard label="Bu ay tahsilat" value={formatMoney(overview.collectedThisMonth)} hint={`${overview.paymentsThisMonth} makbuz`} />
        <StatCard label="Bu ay gider" value={formatMoney(overview.expensesThisMonth)} />
        <StatCard label="Bu ay net" value={formatMoney(overview.collectedThisMonth - overview.expensesThisMonth)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <Card>
          <CardHeader title="Son 12 ay" description={`Tahsilat ${formatMoney(income)} · gider ${formatMoney(expense)} · fark ${formatMoney(income - expense)}`} />
          <CardBody>
            <IncomeExpenseChart rows={months} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Dağılım (son 12 ay)" />
          <CardBody className="space-y-4 text-sm">
            <div>
              <p className="mb-1 font-semibold text-slate-800">Tahsilat şekli</p>
              {byMethod.length ? (
                byMethod.map((m) => (
                  <p key={m.method} className="flex justify-between text-slate-600">
                    <span>{PAYMENT_METHOD_LABEL[m.method]}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(m._sum.amount ?? 0)}</span>
                  </p>
                ))
              ) : (
                <p className="text-slate-500">Tahsilat yok</p>
              )}
            </div>
            <div>
              <p className="mb-1 font-semibold text-slate-800">Giderler</p>
              {byCategory.length ? (
                byCategory
                  .sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))
                  .map((c) => (
                    <p key={c.category} className="flex justify-between text-slate-600">
                      <span>{EXPENSE_CATEGORY_LABEL[c.category]}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(c._sum.amount ?? 0)}</span>
                    </p>
                  ))
              ) : (
                <p className="text-slate-500">Gider yok</p>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Son tahsilatlar" action={ctx.can("finance.edit") ? <Link href="/kurum/muhasebe/tahsilat" className="text-sm font-semibold text-brand-700 hover:underline">Tümü</Link> : null} />
        {recent.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Makbuz</Th>
                <Th>Öğrenci</Th>
                <Th>Tarih</Th>
                <Th>Şekil</Th>
                <Th className="text-right">Tutar</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className={p.cancelledAt ? "text-slate-400 line-through" : undefined}>
                  <Td>
                    <Link href={`/kurum/muhasebe/makbuz/${p.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                      #{p.receiptNo}
                    </Link>
                  </Td>
                  <Td>{p.student.firstName} {p.student.lastName}</Td>
                  <Td className="whitespace-nowrap text-xs">{formatDate(p.paidAt)}</Td>
                  <Td className="text-xs">{PAYMENT_METHOD_LABEL[p.method]}</Td>
                  <Td className="whitespace-nowrap text-right font-semibold">{formatMoney(p.amount)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">Henüz tahsilat yok. Öğrenci kartından ödeme planı oluşturup tahsilat ekleyebilirsiniz.</p>
          </CardBody>
        )}
      </Card>
    </>
  );
}

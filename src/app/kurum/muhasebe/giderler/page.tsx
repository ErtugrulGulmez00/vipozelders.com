import { Download } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import { shortDate } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/center/labels";
import { dateStringToDbDate, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { centerTeachers } from "@/server/center/groups";
import { db } from "@/server/db";
import { DeleteExpenseButton, ExpenseForm } from "../finance-forms";
import { FinanceTabs } from "../finance-tabs";

export const metadata: Metadata = { title: "Giderler" };

export default async function ExpensesPage({ searchParams }: PageProps<"/kurum/muhasebe/giderler">) {
  const ctx = await requireCenter("expenses.manage");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const month = /^\d{4}-\d{2}$/.test(String(sp.ay ?? "")) ? String(sp.ay) : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const [expenses, members] = await Promise.all([
    db.centerExpense.findMany({
      where: { centerId: ctx.center.id, date: { gte: dateStringToDbDate(start), lte: dateStringToDbDate(end) } },
      include: { member: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    centerTeachers(ctx.center.id),
  ]);
  const total = expenses.reduce((t, e) => t + e.amount, 0);
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <PageHeader
        title="Giderler"
        actions={
          <a href={`/api/kurum/disa-aktar/giderler?baslangic=${start}&bitis=${end}`} download className={buttonClasses("outline", "sm")}>
            <Download className="size-4" aria-hidden /> CSV
          </a>
        }
      />
      <FinanceTabs ctx={ctx} active="giderler" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card>
          <CardHeader
            title={`${new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)))} giderleri`}
            description={`Toplam ${formatMoney(total)}`}
            action={
              <Form action="/kurum/muhasebe/giderler" className="flex gap-2">
                <Input name="ay" type="month" defaultValue={month} className="h-8 w-40" />
                <button type="submit" className={buttonClasses("secondary", "sm")}>
                  Göster
                </button>
              </Form>
            }
          />
          {byCategory.length ? (
            <CardBody className="flex flex-wrap gap-2 border-b border-slate-100">
              {byCategory.map(([category, amount]) => (
                <span key={category} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {EXPENSE_CATEGORY_LABEL[category]}: {formatMoney(amount)}
                </span>
              ))}
            </CardBody>
          ) : null}
          {expenses.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Tarih</Th>
                  <Th>Tür</Th>
                  <Th>Açıklama</Th>
                  <Th className="text-right">Tutar</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap text-xs">{shortDate(e.date)}</Td>
                    <Td className="text-xs">{EXPENSE_CATEGORY_LABEL[e.category]}</Td>
                    <Td className="text-sm">
                      {e.description ?? "—"}
                      <p className="text-xs text-slate-500">{e.member ? `${e.member.user.firstName} ${e.member.user.lastName}` : e.paidTo}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-right font-semibold">{formatMoney(e.amount)}</Td>
                    <Td>
                      <DeleteExpenseButton expenseId={e.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <CardBody>
              <p className="text-sm text-slate-500">Bu ay gider kaydı yok.</p>
            </CardBody>
          )}
        </Card>
        <Card>
          <CardHeader title="Gider ekle" />
          <CardBody>
            <ExpenseForm members={members.map((t) => ({ id: t.id, name: t.name }))} today={today} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

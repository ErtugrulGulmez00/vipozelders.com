import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { shortDate } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { INSTALLMENT_STATE, PAYMENT_METHOD_LABEL } from "@/lib/center/labels";
import { installmentState } from "@/lib/center/finance";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, formatDate, isDateString, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { studentBalance } from "@/server/center/finance";
import { db } from "@/server/db";
import { PaymentForm, StudentPicker } from "../finance-forms";
import { FinanceTabs } from "../finance-tabs";

export const metadata: Metadata = { title: "Tahsilat" };

export default async function CollectionsPage({ searchParams }: PageProps<"/kurum/muhasebe/tahsilat">) {
  const ctx = await requireCenter("finance.edit");
  const sp = await searchParams;
  const centerId = ctx.center.id;
  const today = toLocalDateString(new Date());
  const from = isDateString(String(sp.baslangic ?? "")) ? String(sp.baslangic) : addDaysToDateString(today, -30);
  const to = isDateString(String(sp.bitis ?? "")) ? String(sp.bitis) : today;
  const studentId = String(sp.ogrenci ?? "") || null;
  const [students, student, payments] = await Promise.all([
    db.centerStudent.findMany({ where: { centerId, status: { not: "LEFT" } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true, studentNumber: true, gradeName: true } }),
    studentId
      ? db.centerStudent.findFirst({
          where: { id: studentId, centerId },
          include: {
            guardians: { where: { isStudentAccount: false }, orderBy: { isPrimary: "desc" } },
            installments: { where: { plan: { isCancelled: false } }, include: { plan: { select: { title: true } } }, orderBy: [{ dueDate: "asc" }, { order: "asc" }] },
          },
        })
      : null,
    db.centerPayment.findMany({
      where: { centerId, paidAt: { gte: new Date(dateStringToDbDate(from).getTime() - 3 * 3_600_000), lt: new Date(dateStringToDbDate(addDaysToDateString(to, 1)).getTime() - 3 * 3_600_000) } },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { receiptNo: "desc" },
      take: 300,
    }),
  ]);
  const balance = student ? await studentBalance(centerId, student.id, today) : null;
  const open = student?.installments.filter((i) => i.paidAmount < i.amount) ?? [];
  const nextDue = open[0] ? open[0].amount - open[0].paidAmount : 0;
  const total = payments.filter((p) => !p.cancelledAt).reduce((t, p) => t + p.amount, 0);
  return (
    <>
      <PageHeader title="Tahsilat" description="Ödeme alın; tutar en eski taksitten başlayarak düşülür ve sıra numaralı makbuz oluşur." />
      <FinanceTabs ctx={ctx} active="tahsilat" />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <Card>
          <CardHeader title="Yeni tahsilat" />
          <CardBody className="space-y-4">
            <StudentPicker
              basePath="/kurum/muhasebe/tahsilat"
              selectedId={studentId}
              students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, meta: [s.studentNumber, s.gradeName].filter(Boolean).join(" · ") }))}
            />
            {student && balance ? (
              <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">
                    <Link href={`/kurum/ogrenciler/${student.id}?sekme=odemeler`} className="hover:underline">
                      {student.firstName} {student.lastName}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Kalan {formatMoney(balance.remaining)} · geciken <span className={balance.overdue ? "font-semibold text-rose-600" : ""}>{formatMoney(balance.overdue)}</span>
                  </p>
                  {open.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {open.slice(0, 4).map((i) => {
                        const state = installmentState({ dueDate: dbDateToString(i.dueDate), amount: i.amount, paidAmount: i.paidAmount }, today);
                        return (
                          <li key={i.id} className="flex items-center justify-between gap-2">
                            <span>
                              {shortDate(i.dueDate)} · {i.plan.title} ({i.order}. taksit)
                            </span>
                            <span className="flex items-center gap-1.5">
                              {formatMoney(i.amount - i.paidAmount)} <Badge tone={INSTALLMENT_STATE[state].tone}>{INSTALLMENT_STATE[state].label}</Badge>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">Açık taksit yok; alınan tutar plan dışı tahsilat olarak kaydedilir.</p>
                  )}
                </div>
                {!ctx.access.writable ? <Alert tone="warning">Abonelik süresi dolduğu için yeni tahsilat kaydedilemez.</Alert> : null}
                <PaymentForm
                  studentId={student.id}
                  suggested={nextDue}
                  payerName={student.guardians[0]?.fullName ?? null}
                  today={today}
                  guardiansReachable={student.guardians.some((g) => g.phone || g.email || g.userId)}
                />
              </>
            ) : (
              <p className="text-sm text-slate-500">Tahsilat almak için öğrenciyi arayıp seçin.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tahsilatlar" description={`${shortDate(from)} – ${shortDate(to)} · toplam ${formatMoney(total)}`} />
          <CardBody className="border-b border-slate-100">
            <Form action="/kurum/muhasebe/tahsilat" className="flex flex-wrap items-end gap-2">
              {studentId ? <input type="hidden" name="ogrenci" value={studentId} /> : null}
              <Field label="Başlangıç">
                <Input name="baslangic" type="date" defaultValue={from} className="h-9 w-40" />
              </Field>
              <Field label="Bitiş">
                <Input name="bitis" type="date" defaultValue={to} className="h-9 w-40" />
              </Field>
              <button type="submit" className={buttonClasses("secondary", "sm", "h-9")}>
                Göster
              </button>
              <a href={`/api/kurum/disa-aktar/tahsilatlar?baslangic=${from}&bitis=${to}`} download className={buttonClasses("ghost", "sm", "h-9")}>
                CSV
              </a>
            </Form>
          </CardBody>
          {payments.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Makbuz</Th>
                  <Th>Öğrenci</Th>
                  <Th>Tarih</Th>
                  <Th className="text-right">Tutar</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className={p.cancelledAt ? "text-slate-400" : undefined}>
                    <Td>
                      <Link href={`/kurum/muhasebe/makbuz/${p.id}`} className="font-mono text-xs font-semibold text-brand-700 hover:underline">
                        #{p.receiptNo}
                      </Link>
                      {p.cancelledAt ? <Badge tone="rose" className="ml-1">İptal</Badge> : null}
                    </Td>
                    <Td className="text-sm">
                      {p.student.firstName} {p.student.lastName}
                      <p className="text-xs text-slate-500">{PAYMENT_METHOD_LABEL[p.method]}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-xs">{formatDate(p.paidAt)}</Td>
                    <Td className={`whitespace-nowrap text-right font-semibold ${p.cancelledAt ? "line-through" : ""}`}>{formatMoney(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <CardBody>
              <p className="text-sm text-slate-500">Bu aralıkta tahsilat yok.</p>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}

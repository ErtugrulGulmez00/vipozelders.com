import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/center/center-client";
import { CenterFlash } from "@/components/center/center-ui";
import { Alert } from "@/components/ui/primitives";
import { PAYMENT_METHOD_LABEL } from "@/lib/center/labels";
import { amountInWords } from "@/lib/center/finance";
import { formatCompact, formatDate, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { studentBalance } from "@/server/center/finance";
import { db } from "@/server/db";
import { uploadUrl } from "@/server/storage";
import { CancelPaymentForm } from "../../finance-forms";

export const metadata: Metadata = { title: "Makbuz" };

export default async function ReceiptPage({ params, searchParams }: PageProps<"/kurum/muhasebe/makbuz/[id]">) {
  const ctx = await requireCenter("finance.view");
  const { id } = await params;
  const sp = await searchParams;
  const payment = await db.centerPayment.findFirst({
    where: { id, centerId: ctx.center.id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, studentNumber: true, gradeName: true } },
      allocations: { include: { installment: { include: { plan: { select: { title: true } } } } } },
      center: { select: { name: true, address: true, phone: true, taxOffice: true, taxNumber: true, logoKey: true } },
    },
  });
  if (!payment) notFound();
  const balance = await studentBalance(ctx.center.id, payment.student.id, toLocalDateString(new Date()));
  const creator = payment.createdById ? await db.user.findUnique({ where: { id: payment.createdById }, select: { firstName: true, lastName: true } }) : null;
  const logo = uploadUrl(payment.center.logoKey);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/kurum/ogrenciler/${payment.student.id}?sekme=odemeler`} className="text-sm font-semibold text-brand-700 hover:underline">
          ← {payment.student.firstName} {payment.student.lastName}
        </Link>
        <div className="flex items-center gap-3">
          {!payment.cancelledAt && ctx.can("finance.edit") ? <CancelPaymentForm paymentId={payment.id} /> : null}
          <PrintButton label="Makbuzu yazdır" />
        </div>
      </div>
      <div className="print:hidden">
        <CenterFlash code={sp.durum} />
      </div>
      {payment.cancelledAt ? (
        <Alert tone="error" className="mb-4" title="Bu tahsilat iptal edildi">
          {formatCompact(payment.cancelledAt)} · {payment.cancelReason}
        </Alert>
      ) : null}
      <article className="relative mx-auto max-w-2xl rounded-2xl border border-slate-300 bg-white p-6 shadow-sm sm:p-8 print:max-w-none print:border-slate-400 print:shadow-none">
        {payment.cancelledAt ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black tracking-widest text-rose-500/20">İPTAL</span>
        ) : null}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            {logo ? <Image src={logo} alt="" width={48} height={48} unoptimized className="size-12 rounded-lg object-contain" /> : null}
            <div>
              <p className="text-lg font-bold text-slate-900">{payment.center.name}</p>
              <p className="text-xs text-slate-500">{[payment.center.address, payment.center.phone].filter(Boolean).join(" · ")}</p>
              {payment.center.taxOffice || payment.center.taxNumber ? (
                <p className="text-xs text-slate-500">
                  {payment.center.taxOffice} {payment.center.taxNumber}
                </p>
              ) : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-700">Tahsilat makbuzu</p>
            <p className="font-mono text-xl font-bold text-brand-700">No {payment.receiptNo}</p>
            <p className="text-xs text-slate-500">{formatDate(payment.paidAt)}</p>
          </div>
        </header>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Öğrenci</dt>
            <dd className="font-semibold text-slate-900">
              {payment.student.firstName} {payment.student.lastName}
              {payment.student.studentNumber ? <span className="font-normal text-slate-500"> · No {payment.student.studentNumber}</span> : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Ödeyen</dt>
            <dd className="font-semibold text-slate-900">{payment.payerName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Ödeme şekli</dt>
            <dd className="text-slate-900">{PAYMENT_METHOD_LABEL[payment.method]}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Açıklama</dt>
            <dd className="text-slate-900">{payment.note ?? (payment.allocations.length ? payment.allocations.map((a) => `${a.installment.plan.title} ${a.installment.order}. taksit`).join(", ") : "—")}</dd>
          </div>
        </dl>
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Tutar</p>
          <p className="text-3xl font-black text-slate-900">{formatMoney(payment.amount)}</p>
          <p className="mt-1 text-sm italic text-slate-600">{amountInWords(payment.amount)}</p>
        </div>
        {payment.allocations.length ? (
          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5">Taksit</th>
                <th className="py-1.5 text-right">Düşülen</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((a) => (
                <tr key={a.installmentId} className="border-b border-slate-100">
                  <td className="py-1.5">
                    {a.installment.plan.title} · {a.installment.order}. taksit ({formatDate(a.installment.dueDate)})
                  </td>
                  <td className="py-1.5 text-right">{formatMoney(a.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p className="mt-4 text-sm text-slate-600">
          Kalan borç: <span className="font-semibold text-slate-900">{formatMoney(balance.remaining)}</span>
        </p>
        <footer className="mt-10 grid grid-cols-2 gap-6 text-center text-xs text-slate-500">
          <div>
            <div className="mx-auto mb-1 h-12 w-40 border-b border-slate-300" />
            Teslim alan{creator ? `: ${creator.firstName} ${creator.lastName}` : ""}
          </div>
          <div>
            <div className="mx-auto mb-1 h-12 w-40 border-b border-slate-300" />
            Ödeyen
          </div>
        </footer>
      </article>
    </>
  );
}

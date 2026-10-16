import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { paymentSubject } from "@/server/payments/subject";
import { PaytrFrame } from "./paytr-frame";

export const metadata: Metadata = { title: "Güvenli ödeme", robots: { index: false } };
export const instant = false;

export default async function PaytrPaymentPage({ params }: PageProps<"/odeme/paytr/[paymentId]">) {
  const user = await requireUser();
  const { paymentId } = await params;
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: true, creditPurchase: true } });
  const subject = payment ? paymentSubject(payment) : null;
  if (!payment || !subject || subject.ownerId !== user.id || payment.provider !== "paytr") redirect("/hesabim");
  const iframeToken = (payment.raw as { paytrIframeToken?: string } | null)?.paytrIframeToken;
  if (payment.status !== "INITIATED" || !iframeToken) redirect(`/odeme/sonuc/${subject.resultId}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Güvenli ödeme</h1>
          <p className="text-sm text-slate-500">
            {subject.code} · {subject.title} · {subject.detail}
          </p>
          {subject.holdExpiresAt ? <p className="text-xs text-slate-400">Saatiniz {formatDateTime(subject.holdExpiresAt)} saatine kadar sizin için ayrılı.</p> : null}
        </div>
        <p className="text-xl font-bold text-slate-900">{formatMoney(payment.amount)}</p>
      </div>
      <Card className="overflow-hidden p-2 sm:p-4">
        <PaytrFrame token={iframeToken} />
      </Card>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
        <LockKeyhole className="size-3.5 shrink-0" aria-hidden /> Kart bilgileriniz PayTR’nin 3D Secure ödeme formunda işlenir; sitemizde saklanmaz.
      </p>
    </div>
  );
}

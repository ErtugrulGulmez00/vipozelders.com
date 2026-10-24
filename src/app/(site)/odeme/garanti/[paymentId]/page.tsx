import { LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { garantiConfig, garantiRaw } from "@/server/payments/garanti";
import { paymentSubject } from "@/server/payments/subject";
import { AutoSubmitForm } from "./auto-submit";

export const metadata: Metadata = { title: "Güvenli ödeme", robots: { index: false } };
export const instant = false;

/** Garanti BBVA ortak ödeme sayfasına yönlendirme: kart bilgisi yalnızca bankanın sayfasında girilir. */
export default async function GarantiPaymentPage({ params }: PageProps<"/odeme/garanti/[paymentId]">) {
  const user = await requireUser();
  const { paymentId } = await params;
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: true, creditPurchase: true, subscription: true, groupEnrollment: { include: { course: true } } } });
  if (!payment || payment.provider !== "garanti") redirect("/hesabim");
  const raw = garantiRaw(payment.raw);
  const subject = paymentSubject(payment);
  // Yönetim panelindeki ödeme testi bir randevuya bağlı değildir; yalnızca yönetici açabilir.
  const allowed = raw.diagnostic ? user.role === "ADMIN" : subject?.ownerId === user.id;
  if (!allowed) redirect("/hesabim");
  if (payment.status !== "INITIATED" || !raw.garantiForm) redirect(raw.diagnostic ? "/yonetim/odeme-testi" : `/odeme/sonuc/${subject!.resultId}`);

  const action = garantiConfig(raw.garantiMode).formUrl;
  return (
    <div className="mx-auto max-w-lg px-4 py-14 text-center">
      <Card className="p-8">
        <LockKeyhole className="mx-auto size-10 text-brand-600" aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Bankanın güvenli ödeme sayfasına yönlendiriliyorsunuz</h1>
        <p className="mt-2 text-sm text-slate-600">
          {subject ? `${subject.code} · ${subject.title} · ` : ""}
          <strong>{formatMoney(payment.amount)}</strong>
        </p>
        <p className="mt-2 text-xs text-slate-500">Kart bilgileriniz Garanti BBVA’nın 3D Secure ödeme sayfasında işlenir; sitemizde saklanmaz.</p>
        <AutoSubmitForm action={action} fields={raw.garantiForm} />
      </Card>
    </div>
  );
}

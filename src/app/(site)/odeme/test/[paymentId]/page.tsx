import { CreditCard, FlaskConical } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { mockPaymentAction } from "@/actions/student";
import { Button } from "@/components/ui/button";
import { Alert, Card, DescriptionList } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { paymentSubject } from "@/server/payments/subject";

export const metadata: Metadata = { title: "Test ödeme" };
export const instant = false;

/** Geliştirme ortamı için sahte ödeme sayfası (PayTR bağlanınca kullanılmaz). */
export default async function MockPaymentPage({ params }: PageProps<"/odeme/test/[paymentId]">) {
  const user = await requireUser();
  const { paymentId } = await params;
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { booking: true, creditPurchase: true, subscription: true } });
  const subject = payment ? paymentSubject(payment) : null;
  if (!payment || !subject || subject.ownerId !== user.id || payment.provider !== "mock") redirect("/hesabim");
  if (payment.status !== "INITIATED") redirect(`/odeme/sonuc/${subject.resultId}`);

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Alert tone="warning" title="Test ödeme sayfası" className="mb-4">
        Geliştirme ortamındasınız; gerçek kart bilgisi istenmez ve para çekilmez. PayTR mağaza bilgileri girildiğinde bu sayfanın yerine PayTR’nin 3D Secure ödeme formu açılır.
      </Alert>
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-bold text-slate-900">Güvenli ödeme</h1>
            <p className="text-xs text-slate-500">{subject.code}</p>
          </div>
        </div>
        <DescriptionList
          items={[
            { label: subject.kind === "booking" ? "Ders" : "Paket", value: subject.title },
            { label: subject.kind === "booking" ? "Zaman" : "Açıklama", value: subject.detail },
            { label: "Tutar", value: <strong>{formatMoney(payment.amount)}</strong> },
          ]}
        />
        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 font-mono text-sm text-slate-500">
          <span>5528 7900 0000 0008</span>
          <span>12/30 · 123 · TEST KULLANICI</span>
        </div>
        <div className="mt-6 grid gap-2">
          <form action={mockPaymentAction}>
            <input type="hidden" name="paymentId" value={payment.id} />
            <input type="hidden" name="outcome" value="success" />
            <Button type="submit" size="lg" className="w-full">
              {formatMoney(payment.amount)} öde (başarılı test)
            </Button>
          </form>
          <form action={mockPaymentAction}>
            <input type="hidden" name="paymentId" value={payment.id} />
            <input type="hidden" name="outcome" value="failure" />
            <Button type="submit" variant="outline" className="w-full">
              <FlaskConical className="size-4" aria-hidden /> Başarısız ödeme dene
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

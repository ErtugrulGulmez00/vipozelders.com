import { CheckCircle2, Clock, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { retryPaymentAction } from "@/actions/student";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { LinkButton } from "@/components/ui/button";
import { Card, DescriptionList } from "@/components/ui/primitives";
import { formatDateTime, formatLessonRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/current-user";
import { completeCheckout } from "@/server/bookings";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Ödeme sonucu" };
export const instant = false;

export default async function PaymentResultPage({ params }: PageProps<"/odeme/sonuc/[bookingId]">) {
  const user = await requireUser();
  const { bookingId } = await params;
  const load = () =>
    db.booking.findUnique({
      where: { id: bookingId },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 }, teacher: { select: { slug: true } } },
    });
  let booking = await load();
  if (!booking || booking.studentId !== user.id) redirect("/hesabim");
  let payment = booking.payments[0];

  // PayTR sonucu sunucuya bildirimle gelir; henüz gelmediyse durum sorgusuyla kontrol edilir.
  const awaitingProvider = payment?.status === "INITIATED" && payment.provider === "paytr" && payment.providerToken;
  if (awaitingProvider) {
    await completeCheckout(payment.providerToken!).catch((error: unknown) => console.error("[ödeme sonucu]", error));
    booking = (await load())!;
    payment = booking.payments[0];
  }
  const now = new Date();
  const holdValid = booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt && booking.holdExpiresAt > now;

  const details = (
    <DescriptionList
      items={[
        { label: "Randevu no", value: booking.code },
        { label: "Ders", value: `${booking.levelName} ${booking.subjectName} · ${booking.serviceName}` },
        { label: "Zaman", value: formatLessonRange(booking.startAt, booking.endAt) },
        { label: "Tutar", value: formatMoney(booking.price) },
      ]}
    />
  );

  if (booking.status === "PENDING_APPROVAL" || booking.status === "CONFIRMED") {
    return (
      <Result icon={<CheckCircle2 className="size-12 text-emerald-500" />} title="Ödemeniz alındı">
        <p className="text-slate-600">
          {booking.status === "CONFIRMED"
            ? "Dersiniz onaylandı."
            : `Talebiniz öğretmene iletildi. Öğretmen ${booking.approvalDeadline ? formatDateTime(booking.approvalDeadline) : "kısa süre"} saatine kadar onaylayacak; onaylanmazsa ücretin tamamı iade edilir.`}
        </p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <LinkButton href={`/hesabim/derslerim/${booking.id}`} size="lg" className="mt-6">
          Randevuma git
        </LinkButton>
      </Result>
    );
  }

  // Süresi dolan saat için de kısa bir süre geç gelen bildirim beklenir (PayTR formu 30 dk açık kalır).
  const awaitingResult =
    payment?.status === "INITIATED" &&
    payment.provider === "paytr" &&
    (booking.status === "PENDING_PAYMENT" || (booking.status === "EXPIRED" && payment.createdAt.getTime() > now.getTime() - 35 * 60_000));
  if (awaitingResult) {
    return (
      <Result icon={<LoaderCircle className="size-12 animate-spin text-brand-500" />} title="Ödemeniz kontrol ediliyor">
        <AutoRefresh />
        <p className="text-slate-600">Bankanızdan gelen sonuç bekleniyor. Bu sayfa birkaç saniyede bir kendiliğinden yenilenir.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        {booking.status === "PENDING_PAYMENT" ? (
          <LinkButton href={`/odeme/paytr/${payment!.id}`} variant="outline" className="mt-6">
            Ödeme formuna dön
          </LinkButton>
        ) : null}
      </Result>
    );
  }

  if (holdValid) {
    return (
      <Result icon={<XCircle className="size-12 text-rose-500" />} title="Ödeme tamamlanamadı">
        <p className="text-slate-600">{payment?.failureReason ?? "Ödeme işlemi tamamlanmadı."} Saatiniz {formatDateTime(booking.holdExpiresAt!)} saatine kadar sizin için ayrılı; tekrar deneyebilirsiniz.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <ActionForm action={retryPaymentAction} className="mt-6">
          <input type="hidden" name="bookingId" value={booking.id} />
          <SubmitButton size="lg" pendingText="Hazırlanıyor…">
            <RotateCcw className="size-4" aria-hidden /> Tekrar dene
          </SubmitButton>
        </ActionForm>
      </Result>
    );
  }

  return (
    <Result icon={<Clock className="size-12 text-slate-400" />} title={booking.refundedAmount > 0 ? "Ödemeniz iade ediliyor" : "Ödeme süresi doldu"}>
      <p className="text-slate-600">
        {booking.refundedAmount > 0
          ? `${formatMoney(booking.refundedAmount)} kartınıza iade ediliyor.`
          : "Seçtiğiniz saat için ödeme süresi doldu. Öğretmenin takviminden yeniden saat seçebilirsiniz."}
      </p>
      <LinkButton href={`/ogretmen/${booking.teacher.slug}`} size="lg" className="mt-6">
        Yeni saat seç
      </LinkButton>
    </Result>
  );
}

function Result({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-14 text-center">
      {icon}
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-2 w-full">{children}</div>
    </div>
  );
}

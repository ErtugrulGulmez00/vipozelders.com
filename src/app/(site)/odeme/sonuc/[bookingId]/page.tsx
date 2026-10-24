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

/** Sonucu bankadan sonradan gelen sağlayıcılar (dönüşte durum sorgusuyla kontrol edilir). */
const REMOTE_PROVIDERS = new Set(["paytr", "garanti"]);
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
  if (!booking) {
    const subscription = await db.questionSubscription.findUnique({ where: { id: bookingId }, select: { id: true } });
    if (subscription) return <SubscriptionResult subscriptionId={bookingId} userId={user.id} />;
    const group = await db.groupEnrollment.findUnique({ where: { id: bookingId }, select: { id: true } });
    if (group) return <GroupResult enrollmentId={bookingId} userId={user.id} />;
    return <CreditPurchaseResult purchaseId={bookingId} userId={user.id} />;
  }
  if (booking.studentId !== user.id) redirect("/hesabim");
  let payment = booking.payments[0];

  // Banka sonucu (PayTR bildirimi, Garanti dönüşü) henüz işlenmediyse durum sorgusuyla kontrol edilir.
  const awaitingProvider = payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider) && payment.providerToken;
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
        { label: "Zaman", value: booking.mode === "QUESTION" ? "Fotoğrafla soru (saat yok)" : formatLessonRange(booking.startAt, booking.endAt) },
        { label: "Tutar", value: booking.discountAmount ? `${formatMoney(booking.price)} (${formatMoney(booking.discountAmount)} indirim uygulandı)` : formatMoney(booking.price) },
      ]}
    />
  );

  if (booking.status === "PENDING_APPROVAL" || booking.status === "CONFIRMED") {
    return (
      <Result icon={<CheckCircle2 className="size-12 text-emerald-500" />} title="Ödemeniz alındı">
        <p className="text-slate-600">
          {booking.status === "CONFIRMED"
            ? "Dersiniz onaylandı."
            : booking.mode === "QUESTION"
              ? `Sorunuz öğretmene iletildi. Çözüm en geç ${booking.approvalDeadline ? formatDateTime(booking.approvalDeadline) : "kısa süre içinde"} saatine kadar gelecek; gelmezse ücretin tamamı iade edilir.`
              : `Talebiniz öğretmene iletildi. Öğretmen ${booking.approvalDeadline ? formatDateTime(booking.approvalDeadline) : "kısa süre"} saatine kadar onaylayacak; onaylanmazsa ücretin tamamı iade edilir.`}
        </p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <LinkButton href={`/hesabim/derslerim/${booking.id}`} size="lg" className="mt-6">
          {booking.mode === "QUESTION" ? "Soruma git" : "Randevuma git"}
        </LinkButton>
      </Result>
    );
  }

  // Süresi dolan saat için de kısa bir süre geç gelen bildirim beklenir (PayTR formu 30 dk, Garanti sayfası 5 dk açık kalır).
  const awaitingResult =
    payment?.status === "INITIATED" &&
    REMOTE_PROVIDERS.has(payment.provider) &&
    (booking.status === "PENDING_PAYMENT" || (booking.status === "EXPIRED" && payment.createdAt.getTime() > now.getTime() - 35 * 60_000));
  if (awaitingResult) {
    return (
      <Result icon={<LoaderCircle className="size-12 animate-spin text-brand-500" />} title="Ödemeniz kontrol ediliyor">
        <AutoRefresh />
        <p className="text-slate-600">Bankanızdan gelen sonuç bekleniyor. Bu sayfa birkaç saniyede bir kendiliğinden yenilenir.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        {booking.status === "PENDING_PAYMENT" ? (
          <LinkButton href={`/odeme/${payment!.provider}/${payment!.id}`} variant="outline" className="mt-6">
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

/** Soru kredisi paketi ödemesinin sonucu (aynı adres, paketin kimliğiyle). */
async function CreditPurchaseResult({ purchaseId, userId }: { purchaseId: string; userId: string }) {
  const load = () => db.creditPurchase.findUnique({ where: { id: purchaseId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  let purchase = await load();
  if (!purchase || purchase.studentId !== userId) redirect("/hesabim");
  let payment = purchase.payments[0];
  if (payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider) && payment.providerToken) {
    await completeCheckout(payment.providerToken).catch((error: unknown) => console.error("[ödeme sonucu]", error));
    purchase = (await load())!;
    payment = purchase.payments[0];
  }
  const details = (
    <DescriptionList
      items={[
        { label: "Paket no", value: purchase.code },
        { label: "Paket", value: `${purchase.credits} soru kredisi` },
        { label: "Tutar", value: formatMoney(purchase.price) },
        ...(purchase.expiresAt ? [{ label: "Son kullanma", value: formatDateTime(purchase.expiresAt) }] : []),
      ]}
    />
  );
  if (purchase.status === "PAID" || purchase.status === "PARTIALLY_REFUNDED") {
    return (
      <Result icon={<CheckCircle2 className="size-12 text-emerald-500" />} title="Kredileriniz hesabınızda">
        <p className="text-slate-600">Sorunuzun fotoğrafını çekip gönderin; her soru 1 kredi.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <LinkButton href="/soru-sor" size="lg" className="mt-6">
          Soru sor
        </LinkButton>
      </Result>
    );
  }
  if (purchase.status === "PENDING_PAYMENT" && payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider)) {
    return (
      <Result icon={<LoaderCircle className="size-12 animate-spin text-brand-500" />} title="Ödemeniz kontrol ediliyor">
        <AutoRefresh />
        <p className="text-slate-600">Bankanızdan gelen sonuç bekleniyor. Bu sayfa birkaç saniyede bir kendiliğinden yenilenir.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <LinkButton href={`/odeme/${payment.provider}/${payment.id}`} variant="outline" className="mt-6">
          Ödeme formuna dön
        </LinkButton>
      </Result>
    );
  }
  if (purchase.status === "REFUNDED") {
    return (
      <Result icon={<Clock className="size-12 text-slate-400" />} title="Paket iade edildi">
        <p className="text-slate-600">{formatMoney(purchase.refundedAmount)} kartınıza iade edildi.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
      </Result>
    );
  }
  return (
    <Result icon={<XCircle className="size-12 text-rose-500" />} title="Ödeme tamamlanamadı">
      <p className="text-slate-600">{payment?.failureReason ?? "Ödeme işlemi tamamlanmadı."} Kartınızdan para çekilmedi; tekrar deneyebilirsiniz.</p>
      <Card className="mt-6 p-5 text-left">{details}</Card>
      <LinkButton href="/soru-sor" size="lg" className="mt-6">
        <RotateCcw className="size-4" aria-hidden /> Paket seçimine dön
      </LinkButton>
    </Result>
  );
}

/** Grup dersi kaydı ödemesinin sonucu. */
async function GroupResult({ enrollmentId, userId }: { enrollmentId: string; userId: string }) {
  const load = () => db.groupEnrollment.findUnique({ where: { id: enrollmentId }, include: { course: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  let enrollment = await load();
  if (!enrollment || enrollment.studentId !== userId) redirect("/hesabim");
  let payment = enrollment.payments[0];
  if (payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider) && payment.providerToken) {
    await completeCheckout(payment.providerToken).catch((error: unknown) => console.error("[ödeme sonucu]", error));
    enrollment = (await load())!;
    payment = enrollment.payments[0];
  }
  const { course } = enrollment;
  const details = (
    <DescriptionList
      items={[
        { label: "Kayıt no", value: enrollment.code },
        { label: "Ders", value: course.title },
        { label: "Tutar", value: formatMoney(enrollment.price) },
        { label: "Son kayıt", value: formatDateTime(course.enrollDeadline) },
      ]}
    />
  );
  if (enrollment.status === "PAID") {
    return (
      <Result icon={<CheckCircle2 className="size-12 text-emerald-500" />} title="Grup dersine kaydınız tamamlandı">
        <p className="text-slate-600">
          {course.status === "CONFIRMED" ? "Ders kesinleşti; oturum saatlerinde “Derse katıl” düğmesi açılır." : `Ders, kayıt bitişinde en az ${course.minParticipants} kişiye ulaşırsa açılır; ulaşmazsa ücretin tamamı iade edilir.`}
        </p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <LinkButton href={`/hesabim/grup-derslerim/${enrollment.id}`} size="lg" className="mt-6">
          Grup dersime git
        </LinkButton>
      </Result>
    );
  }
  if (enrollment.status === "PENDING_PAYMENT" && payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider)) {
    return (
      <Result icon={<LoaderCircle className="size-12 animate-spin text-brand-500" />} title="Ödemeniz kontrol ediliyor">
        <AutoRefresh />
        <p className="text-slate-600">Bankanızdan gelen sonuç bekleniyor. Bu sayfa birkaç saniyede bir kendiliğinden yenilenir.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
      </Result>
    );
  }
  if (enrollment.status === "CANCELLED" && enrollment.refundedAmount > 0) {
    return (
      <Result icon={<Clock className="size-12 text-slate-400" />} title="Kayıt tamamlanamadı">
        <p className="text-slate-600">{formatMoney(enrollment.refundedAmount)} kartınıza iade ediliyor.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
      </Result>
    );
  }
  return (
    <Result icon={<XCircle className="size-12 text-rose-500" />} title="Ödeme tamamlanamadı">
      <p className="text-slate-600">{payment?.failureReason ?? "Ödeme işlemi tamamlanmadı."} Kartınızdan para çekilmedi; tekrar deneyebilirsiniz.</p>
      <Card className="mt-6 p-5 text-left">{details}</Card>
      <LinkButton href={`/grup-dersleri/${course.code}`} size="lg" className="mt-6">
        <RotateCcw className="size-4" aria-hidden /> Tekrar dene
      </LinkButton>
    </Result>
  );
}

/** Soru aboneliği ödemesinin sonucu. */
async function SubscriptionResult({ subscriptionId, userId }: { subscriptionId: string; userId: string }) {
  const load = () => db.questionSubscription.findUnique({ where: { id: subscriptionId }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  let sub = await load();
  if (!sub || sub.studentId !== userId) redirect("/hesabim");
  let payment = sub.payments[0];
  if (payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider) && payment.providerToken) {
    await completeCheckout(payment.providerToken).catch((error: unknown) => console.error("[ödeme sonucu]", error));
    sub = (await load())!;
    payment = sub.payments[0];
  }
  const details = (
    <DescriptionList
      items={[
        { label: "Abonelik no", value: sub.code },
        { label: "Abonelik", value: `${sub.levelName} ${sub.subjectName} · günde ${sub.dailyLimit} soru` },
        { label: "Tutar", value: formatMoney(sub.price) },
        ...(sub.startsAt && sub.endsAt ? [{ label: "Dönem", value: `${formatDateTime(sub.startsAt)} – ${formatDateTime(sub.endsAt)}` }] : []),
      ]}
    />
  );
  if (sub.status === "ACTIVE") {
    // Yenilemede yeni dönem mevcut dönem bitince başlar
    const queued = Boolean(sub.startsAt && sub.startsAt > new Date());
    return (
      <Result icon={<CheckCircle2 className="size-12 text-emerald-500" />} title={queued ? "Aboneliğiniz yenilendi" : "Aboneliğiniz başladı"}>
        <p className="text-slate-600">
          {queued
            ? `Yeni dönem ${formatDateTime(sub.startsAt!)} tarihinde başlayacak; o zamana kadar mevcut aboneliğinizden soru göndermeye devam edebilirsiniz.`
            : "Sorularınızın fotoğrafını abonelik sayfanızdan doğrudan öğretmeninize gönderebilirsiniz."}
        </p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
        <LinkButton href={queued ? "/hesabim/abonelikler" : `/hesabim/abonelikler/${sub.id}`} size="lg" className="mt-6">
          {queued ? "Aboneliklerim" : "Soru gönder"}
        </LinkButton>
      </Result>
    );
  }
  if (sub.status === "PENDING_PAYMENT" && payment?.status === "INITIATED" && REMOTE_PROVIDERS.has(payment.provider)) {
    return (
      <Result icon={<LoaderCircle className="size-12 animate-spin text-brand-500" />} title="Ödemeniz kontrol ediliyor">
        <AutoRefresh />
        <p className="text-slate-600">Bankanızdan gelen sonuç bekleniyor. Bu sayfa birkaç saniyede bir kendiliğinden yenilenir.</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
      </Result>
    );
  }
  if (sub.status === "REFUNDED" || sub.status === "CANCELLED" || sub.status === "ENDED") {
    return (
      <Result icon={<Clock className="size-12 text-slate-400" />} title="Abonelik sona erdi">
        <p className="text-slate-600">{sub.refundedAmount ? `${formatMoney(sub.refundedAmount)} kartınıza iade edildi.` : "Bu abonelik dönemi tamamlandı."}</p>
        <Card className="mt-6 p-5 text-left">{details}</Card>
      </Result>
    );
  }
  return (
    <Result icon={<XCircle className="size-12 text-rose-500" />} title="Ödeme tamamlanamadı">
      <p className="text-slate-600">{payment?.failureReason ?? "Ödeme işlemi tamamlanmadı."} Kartınızdan para çekilmedi; tekrar deneyebilirsiniz.</p>
      <Card className="mt-6 p-5 text-left">{details}</Card>
      {sub.planId ? (
        <LinkButton href={`/abonelik/${sub.planId}`} size="lg" className="mt-6">
          <RotateCcw className="size-4" aria-hidden /> Tekrar dene
        </LinkButton>
      ) : null}
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

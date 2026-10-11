import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusBadge } from "@/components/panel/booking-ui";
import { FlashNotice } from "@/components/panel/flash-notice";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatCompact, formatLessonRange } from "@/lib/dates";
import { BOOKING_STATUS, durationLabel, IN_PERSON_PLACE_LABEL, MODE_LABEL, PAYMENT_STATUS, REFUND_STATUS } from "@/lib/labels";
import { formatBps, formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { pendingForBooking } from "@/server/ledger";
import { AdminCancelForm, ResolveDisputeForm, RetryRefundButton } from "./booking-admin-forms";

export const metadata: Metadata = { title: "Randevu" };

const ADMIN_CANCELLABLE = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "DISPUTED", "COMPLETED", "NO_SHOW_STUDENT"];

export default async function AdminBookingPage({ params, searchParams }: PageProps<"/yonetim/randevular/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { durum } = await searchParams;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: true } },
      student: true,
      district: { include: { city: true } },
      payments: { include: { refunds: true }, orderBy: { createdAt: "asc" } },
      events: { include: { actor: { select: { firstName: true, lastName: true, role: true } } }, orderBy: { createdAt: "asc" } },
      attendance: { include: { user: { select: { firstName: true } } }, orderBy: { joinedAt: "asc" } },
      review: true,
    },
  });
  if (!booking) notFound();
  const pending = await pendingForBooking(db, booking.id);
  const remaining = booking.price - booking.refundedAmount;
  const cancellable = ADMIN_CANCELLABLE.includes(booking.status) && !booking.earningsReleasedAt;

  return (
    <>
      <Link href="/yonetim/randevular" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Randevular
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{booking.code}</h1>
        <BookingStatusBadge status={booking.status} />
      </div>
      <FlashNotice code={durum} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {booking.status === "DISPUTED" ? (
            <Alert tone="warning" title="Açık itiraz">
              “{booking.disputeReason}” · {booking.disputedAt ? formatCompact(booking.disputedAt) : ""}
            </Alert>
          ) : null}
          <Card>
            <CardHeader title="Ders" />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Ders", value: `${booking.levelName} ${booking.subjectName} · ${booking.serviceName}` },
                  { label: "Zaman", value: formatLessonRange(booking.startAt, booking.endAt) },
                  { label: "Süre", value: durationLabel(booking.durationMinutes) },
                  { label: "Şekil", value: `${MODE_LABEL[booking.mode]}${booking.inPersonPlace ? ` · ${IN_PERSON_PLACE_LABEL[booking.inPersonPlace]}` : ""}` },
                  ...(booking.mode === "IN_PERSON" ? [{ label: "Adres", value: [booking.address, booking.district ? `${booking.district.name} / ${booking.district.city.name}` : null].filter(Boolean).join(" — ") || "—" }] : []),
                  {
                    label: "Öğretmen",
                    value: (
                      <Link href={`/yonetim/ogretmenler/${booking.teacherId}`} className="text-brand-700 hover:underline">
                        {booking.teacher.user.firstName} {booking.teacher.user.lastName}
                      </Link>
                    ),
                  },
                  {
                    label: "Veli / öğrenci",
                    value: (
                      <Link href={`/yonetim/ogrenciler/${booking.studentId}`} className="text-brand-700 hover:underline">
                        {booking.student.firstName} {booking.student.lastName} ({booking.student.email}) · {booking.learnerName}
                        {booking.learnerGrade ? `, ${booking.learnerGrade}` : ""}
                      </Link>
                    ),
                  },
                  ...(booking.studentNote ? [{ label: "Not", value: booking.studentNote }] : []),
                  ...(booking.cancelReason ? [{ label: "İptal gerekçesi", value: booking.cancelReason }] : []),
                  ...(booking.rejectionReason ? [{ label: "Red gerekçesi", value: booking.rejectionReason }] : []),
                  ...(booking.review ? [{ label: "Yorum", value: `${booking.review.rating}★ ${booking.review.comment ?? ""}` }] : []),
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Para" />
            <CardBody className="space-y-4">
              <DescriptionList
                items={[
                  { label: "Ders ücreti", value: formatMoney(booking.price) },
                  { label: "Komisyon", value: `${formatMoney(booking.commissionAmount)} (${formatBps(booking.commissionRateBps)})` },
                  { label: "Öğretmen payı", value: formatMoney(booking.teacherAmount) },
                  { label: "İade edilen", value: formatMoney(booking.refundedAmount) },
                  { label: "Bekleyen hakediş", value: formatMoney(pending) },
                  { label: "Hakediş", value: booking.earningsReleasedAt ? `Serbest bırakıldı (${formatCompact(booking.earningsReleasedAt)})` : booking.earningsReleaseAt ? `${formatCompact(booking.earningsReleaseAt)} sonrası` : "—" },
                ]}
              />
              {booking.payments.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {p.provider} · {formatMoney(p.amount)} · {formatCompact(p.createdAt)}
                    </span>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </div>
                  {p.failureReason ? <p className="mt-1 text-xs text-rose-600">{p.failureReason}</p> : null}
                  {p.providerPaymentId ? <p className="mt-1 text-xs text-slate-400">Ödeme no: {p.providerPaymentId}</p> : null}
                  {p.refunds.map((r) => (
                    <div key={r.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                      <span>
                        İade {formatMoney(r.amount)} — {r.reason}
                        {r.error ? <span className="block text-rose-600">{r.error}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={REFUND_STATUS[r.status].tone}>{REFUND_STATUS[r.status].label}</Badge>
                        {r.status === "FAILED" ? <RetryRefundButton refundId={r.id} /> : null}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Durum geçmişi" />
            <CardBody>
              <ol className="space-y-3 border-l border-slate-200 pl-4 text-sm">
                {booking.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand-400" />
                    <p className="font-medium text-slate-800">
                      {e.fromStatus ? `${BOOKING_STATUS[e.fromStatus]?.label} → ` : ""}
                      {BOOKING_STATUS[e.toStatus]?.label}
                    </p>
                    <p className="text-slate-500">
                      {e.note}
                      {e.actor ? ` · ${e.actor.firstName} ${e.actor.lastName}` : " · sistem"}
                    </p>
                    <p className="text-xs text-slate-400">{formatCompact(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
        <aside className="space-y-6">
          {booking.status === "DISPUTED" ? (
            <Card>
              <CardHeader title="İtirazı sonuçlandır" />
              <CardBody>
                <ResolveDisputeForm bookingId={booking.id} maxRefund={String(remaining / 100)} />
              </CardBody>
            </Card>
          ) : null}
          {cancellable ? (
            <Card>
              <CardHeader title="Yönetici iptali" />
              <CardBody>
                <AdminCancelForm bookingId={booking.id} maxRefund={String(remaining / 100)} suggested={String(remaining / 100)} />
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Sanal sınıf yoklaması" />
            <CardBody className="space-y-1 text-sm">
              {booking.attendance.length === 0 ? <p className="text-slate-500">Katılım kaydı yok.</p> : null}
              {booking.attendance.map((a) => (
                <p key={a.id}>
                  {a.user.firstName}: {formatCompact(a.joinedAt)} {a.leftAt ? `→ ${formatCompact(a.leftAt)}` : ""}
                </p>
              ))}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

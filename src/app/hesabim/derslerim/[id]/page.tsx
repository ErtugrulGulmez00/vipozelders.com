import { ArrowLeft, Eye, MapPin, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusBadge } from "@/components/panel/booking-ui";
import { CalendarLinks } from "@/components/panel/calendar-links";
import { FlashNotice } from "@/components/panel/flash-notice";
import { QuestionThread } from "@/components/panel/question-thread";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatCompact, formatDateTime, formatLessonRange } from "@/lib/dates";
import { BOOKING_STATUS, durationLabel, IN_PERSON_PLACE_LABEL, MODE_LABEL, PAYMENT_STATUS, REFUND_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName, initials } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { previewStudentCancellation } from "@/server/bookings";
import { db } from "@/server/db";
import { lessonCalendarEvent } from "@/server/lesson-calendar";
import { reviewEligibility } from "@/server/reviews";
import { loadSettings } from "@/server/settings";
import { uploadUrl } from "@/server/storage";
import { CancelForm, DisputeForm, ReviewForm } from "./student-forms";

export const metadata: Metadata = { title: "Ders ayrıntısı" };

export default async function StudentBookingPage({ params, searchParams }: PageProps<"/hesabim/derslerim/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const { durum } = await searchParams;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      district: { include: { city: true } },
      payments: { include: { refunds: true }, orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      review: true,
    },
  });
  if (!booking || booking.studentId !== user.id) notFound();

  const now = new Date();
  const settings = await loadSettings();
  const teacherName = fullName(booking.teacher.user);
  const cancellation = await previewStudentCancellation(booking, now);
  const eligibility = await reviewEligibility(user.id, booking.teacherId, now);
  const opensAt = new Date(booking.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
  const classroomOpen = booking.status === "CONFIRMED" && booking.mode === "ONLINE" && now >= opensAt && now <= new Date(booking.endAt.getTime() + 15 * 60_000);
  const calendarEvent = booking.status === "CONFIRMED" && booking.endAt > now ? await lessonCalendarEvent(booking, "STUDENT", teacherName) : null;
  const canDispute = ["COMPLETED", "NO_SHOW_STUDENT"].includes(booking.status) && !booking.earningsReleasedAt && booking.earningsReleaseAt && booking.earningsReleaseAt > now;

  const refundText =
    booking.status === "PENDING_PAYMENT"
      ? "Ödeme yapılmadığı için iade söz konusu değil."
      : cancellation.refundAmount === booking.price
        ? `Şimdi iptal ederseniz ödediğiniz ${formatMoney(booking.price)} tamamen iade edilir.`
        : cancellation.refundAmount > 0
          ? `Şimdi iptal ederseniz ${formatMoney(cancellation.refundAmount)} (%${cancellation.refundPercent}) iade edilir.`
          : "Derse çok az kaldığı için iptal politikası gereği iade yapılmaz.";

  return (
    <>
      <Link href="/hesabim/derslerim" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Derslerim
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {booking.levelName} · {booking.subjectName}
        </h1>
        <BookingStatusBadge status={booking.status} />
      </div>
      <FlashNotice code={durum} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {booking.mode === "QUESTION" && booking.status === "PENDING_APPROVAL" && booking.approvalDeadline ? (
            <Alert tone="info" title="Çözüm bekleniyor">
              Öğretmeniniz çözümü en geç {formatDateTime(booking.approvalDeadline)} saatine kadar gönderecek. Gelmezse ödemenizin tamamı otomatik iade edilir.
            </Alert>
          ) : null}
          {booking.mode !== "QUESTION" && booking.status === "PENDING_APPROVAL" && booking.approvalDeadline ? (
            <Alert tone="info" title="Öğretmen onayı bekleniyor">
              Öğretmeniniz {formatDateTime(booking.approvalDeadline)} saatine kadar yanıt verecek. Onaylanmazsa ödemenizin tamamı otomatik iade edilir.
            </Alert>
          ) : null}
          {booking.status === "CONFIRMED" && booking.mode === "ONLINE" ? (
            <Card className="border-brand-200 bg-brand-50/60">
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Sanal sınıf</p>
                  <p className="text-sm text-slate-600">
                    {classroomOpen ? "Sınıf açık, derse katılabilirsiniz." : `Sınıf ${formatDateTime(opensAt)} saatinde açılacak.`}
                  </p>
                </div>
                {classroomOpen ? (
                  <div className="flex flex-wrap gap-2">
                    <LinkButton href={`/ders/${booking.id}`} size="lg">
                      <Video className="size-4" aria-hidden /> Derse katıl
                    </LinkButton>
                    {/* Öğrenci dersteyken veli ikinci bir cihazdan görünmeden izleyebilir */}
                    <LinkButton href={`/ders/${booking.id}?izle=1`} size="lg" variant="outline">
                      <Eye className="size-4" aria-hidden /> Veli olarak izle
                    </LinkButton>
                  </div>
                ) : (
                  <Badge tone="slate">Henüz açılmadı</Badge>
                )}
              </CardBody>
            </Card>
          ) : null}

          {booking.mode === "QUESTION" && booking.status !== "PENDING_PAYMENT" ? <QuestionThread booking={booking} viewerId={user.id} /> : null}

          <Card>
            <CardHeader title={booking.mode === "QUESTION" ? "Soru bilgileri" : "Ders bilgileri"} />
            <CardBody>
              <DescriptionList
                items={[
                  { label: "Randevu no", value: booking.code },
                  ...(booking.mode === "QUESTION"
                    ? [{ label: "Gönderildi", value: formatDateTime(booking.createdAt) }]
                    : [
                        { label: "Zaman", value: formatLessonRange(booking.startAt, booking.endAt) },
                        { label: "Süre", value: durationLabel(booking.durationMinutes) },
                      ]),
                  { label: "Hizmet", value: booking.serviceName },
                  { label: "Öğrenci", value: `${booking.learnerName}${booking.learnerGrade ? ` · ${booking.learnerGrade}` : ""}` },
                  { label: "Ders şekli", value: `${MODE_LABEL[booking.mode]}${booking.inPersonPlace ? ` · ${IN_PERSON_PLACE_LABEL[booking.inPersonPlace]}` : ""}` },
                  ...(booking.mode === "IN_PERSON"
                    ? [
                        {
                          label: "Konum",
                          value: (
                            <span className="inline-flex items-start gap-1">
                              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                              {[booking.address, booking.district ? `${booking.district.name} / ${booking.district.city.name}` : null].filter(Boolean).join(" — ") || "Öğretmenin yeri (onay sonrası paylaşılır)"}
                            </span>
                          ),
                        },
                      ]
                    : []),
                  ...(booking.studentNote && booking.mode !== "QUESTION" ? [{ label: "Notunuz", value: booking.studentNote }] : []),
                  { label: "Ücret", value: formatMoney(booking.price) },
                  ...(booking.refundedAmount ? [{ label: "İade", value: formatMoney(booking.refundedAmount) }] : []),
                ]}
              />
              {calendarEvent ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <CalendarLinks bookingId={booking.id} event={calendarEvent} />
                </div>
              ) : null}
            </CardBody>
          </Card>

          {booking.status === "DISPUTED" ? (
            <Alert tone="info" title="Bildiriminiz inceleniyor">
              “{booking.disputeReason}” — Ekibimiz en kısa sürede sonuçlandıracak.
            </Alert>
          ) : null}

          {eligibility.eligible && booking.status === "COMPLETED" ? (
            <Card>
              <CardHeader title={eligibility.existing ? "Değerlendirmeniz" : "Öğretmeninizi değerlendirin"} description="Puanınız diğer velilere yol gösterir." />
              <CardBody>
                <ReviewForm teacherId={booking.teacherId} initialRating={eligibility.existing?.rating} initialComment={eligibility.existing?.comment} />
              </CardBody>
            </Card>
          ) : null}

          {canDispute ? (
            <Card>
              <CardHeader title="Bir sorun mu yaşadınız?" description={`${formatDateTime(booking.earningsReleaseAt!)} saatine kadar bildirebilirsiniz.`} />
              <CardBody>
                <DisputeForm bookingId={booking.id} />
              </CardBody>
            </Card>
          ) : null}

          {cancellation.allowed ? (
            <Card>
              <CardHeader title="Randevuyu iptal et" />
              <CardBody>
                <CancelForm bookingId={booking.id} refundText={refundText} />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar src={uploadUrl(booking.teacher.photoKey)} name={teacherName} initials={initials(booking.teacher.user)} size={52} />
              <div>
                <p className="font-semibold text-slate-900">{teacherName}</p>
                <Link href={`/ogretmen/${booking.teacher.slug}`} className="text-sm font-medium text-brand-700 hover:underline">
                  Profili gör
                </Link>
              </div>
            </div>
            <LinkButton href={`/ogretmen/${booking.teacher.slug}`} variant="outline" className="mt-4 w-full">
              Tekrar ders al
            </LinkButton>
          </Card>

          <Card>
            <CardHeader title="Ödeme" />
            <CardBody className="space-y-3 text-sm">
              {booking.payments.length === 0 ? <p className="text-slate-500">Ödeme yapılmadı.</p> : null}
              {booking.payments.map((p) => (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>{formatMoney(p.amount)}</span>
                    <Badge tone={PAYMENT_STATUS[p.status].tone}>{PAYMENT_STATUS[p.status].label}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{formatCompact(p.createdAt)}</p>
                  {p.refunds.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-xs">
                      <span>İade {formatMoney(r.amount)}</span>
                      <Badge tone={REFUND_STATUS[r.status].tone}>{REFUND_STATUS[r.status].label}</Badge>
                    </div>
                  ))}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Geçmiş" />
            <CardBody>
              <ol className="space-y-3 border-l border-slate-200 pl-4 text-sm">
                {booking.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-brand-400" />
                    <p className="font-medium text-slate-800">{BOOKING_STATUS[e.toStatus]?.label ?? e.toStatus}</p>
                    {e.note ? <p className="text-slate-500">{e.note}</p> : null}
                    <p className="text-xs text-slate-400">{formatCompact(e.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

import { ArrowLeft, MapPin, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingStatusBadge } from "@/components/panel/booking-ui";
import { CalendarLinks } from "@/components/panel/calendar-links";
import { FlashNotice } from "@/components/panel/flash-notice";
import { QuestionThread } from "@/components/panel/question-thread";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatDateTime, formatLessonRange } from "@/lib/dates";
import { durationLabel, IN_PERSON_PLACE_LABEL, MODE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { lessonCalendarEvent } from "@/server/lesson-calendar";
import { loadSettings } from "@/server/settings";
import { TeacherCancelForm } from "./cancel-form";
import { PlatformRules } from "@/components/teacher/platform-rules";

export const metadata: Metadata = { title: "Ders ayrıntısı" };

export default async function TeacherLessonPage({ params, searchParams }: PageProps<"/ogretmen-paneli/dersler/[id]">) {
  const user = await requireRole("TEACHER");
  const { id } = await params;
  const { durum } = await searchParams;
  const booking = await db.booking.findUnique({
    where: { id },
    include: { district: { include: { city: true } }, student: { select: { firstName: true, phone: true } }, teacher: { include: { city: true } } },
  });
  if (!booking || booking.teacherId !== user.id) notFound();

  const now = new Date();
  const settings = await loadSettings();
  const opensAt = new Date(booking.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
  const classroomOpen = booking.status === "CONFIRMED" && booking.mode === "ONLINE" && now >= opensAt && now <= new Date(booking.endAt.getTime() + 15 * 60_000);
  const confirmedOrLater = ["CONFIRMED", "COMPLETED", "NO_SHOW_STUDENT", "DISPUTED"].includes(booking.status);
  const calendarEvent = booking.status === "CONFIRMED" && booking.endAt > now ? await lessonCalendarEvent(booking, "TEACHER", booking.learnerName) : null;

  return (
    <>
      <Link href="/ogretmen-paneli/dersler" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Derslerim
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">
          {booking.learnerName} · {booking.levelName} {booking.subjectName}
        </h1>
        <BookingStatusBadge status={booking.status} />
      </div>
      <FlashNotice code={durum} />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {booking.status === "CONFIRMED" && booking.mode === "ONLINE" ? (
            <Card className="border-brand-200 bg-brand-50/60">
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">Sanal sınıf</p>
                  <p className="text-sm text-slate-600">{classroomOpen ? "Sınıf açık." : `Sınıf ${formatDateTime(opensAt)} saatinde açılacak.`}</p>
                </div>
                <PlatformRules className="w-full" />
                {classroomOpen ? (
                  <LinkButton href={`/ders/${booking.id}`} size="lg">
                    <Video className="size-4" aria-hidden /> Derse katıl
                  </LinkButton>
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
                          label: "Adres",
                          value: confirmedOrLater ? (
                            <span className="inline-flex items-start gap-1">
                              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                              {booking.inPersonPlace === "STUDENT_HOME"
                                ? `${booking.address ?? ""} — ${booking.district?.name ?? ""} / ${booking.district?.city.name ?? ""}`
                                : "Sizin belirttiğiniz ders yeri"}
                            </span>
                          ) : (
                            "Onaydan sonra görünür"
                          ),
                        },
                        ...(confirmedOrLater && booking.student.phone ? [{ label: "Veli telefonu", value: booking.student.phone }] : []),
                      ]
                    : []),
                  ...(booking.studentNote && booking.mode !== "QUESTION" ? [{ label: "Öğrencinin notu", value: booking.studentNote }] : []),
                  { label: booking.mode === "QUESTION" ? "Soru ücreti" : "Ders ücreti", value: formatMoney(booking.price) },
                  { label: "Kazancınız", value: <strong>{formatMoney(booking.teacherAmount)}</strong> },
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
            <Alert tone="warning" title="Öğrenci bir sorun bildirdi">
              “{booking.disputeReason}” — Yönetici inceliyor; hakediş inceleme sonuçlanınca serbest kalacak.
            </Alert>
          ) : null}
        </div>
        <aside className="space-y-6">
          {booking.status === "CONFIRMED" && booking.startAt > now ? (
            <Card>
              <CardHeader title="Dersi iptal et" />
              <CardBody>
                <TeacherCancelForm bookingId={booking.id} />
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}

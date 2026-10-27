import { CalendarPlus, MailWarning, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { resendVerificationAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { BookingRow } from "@/components/panel/booking-ui";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { studentBookings, UPCOMING } from "@/server/student-queries";

export const metadata: Metadata = { title: "Hesabım" };

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const now = new Date();
  const settings = await loadSettings();
  const [upcoming, awaitingPayment, toReview] = await Promise.all([
    studentBookings(user.id, { ...UPCOMING, endAt: { gt: now } }, { startAt: "asc" }, 10),
    studentBookings(user.id, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }),
    db.booking.findMany({
      where: {
        studentId: user.id,
        status: "COMPLETED",
        completedAt: { gte: new Date(now.getTime() - settings.reviewWindowDays * 86_400_000) },
        teacher: { reviews: { none: { studentId: user.id } } },
      },
      distinct: ["teacherId"],
      include: { teacher: { select: { user: { select: { firstName: true } } } } },
      take: 5,
    }),
  ]);

  return (
    <>
      <PageHeader title={`Merhaba ${user.firstName}`} description="Derslerinizi buradan takip edebilirsiniz." actions={<LinkButton href="/ogretmenler"><CalendarPlus className="size-4" aria-hidden /> Yeni ders al</LinkButton>} />

      {!user.emailVerified ? (
        <Alert tone="warning" title="E-posta adresinizi doğrulayın" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <MailWarning className="size-4" aria-hidden /> {user.email} adresine gönderdiğimiz bağlantıya tıklayın.
            </span>
            <ActionForm action={resendVerificationAction}>
              <SubmitButton size="sm" variant="outline" pendingText="Gönderiliyor…">
                Bağlantıyı tekrar gönder
              </SubmitButton>
            </ActionForm>
          </div>
        </Alert>
      ) : null}

      {awaitingPayment.length ? (
        <Alert tone="info" title="Ödemesi tamamlanmamış randevunuz var" className="mb-6">
          {awaitingPayment.map((b) => (
            <p key={b.id}>
              {b.levelName} {b.subjectName} ({b.counterpart}) — saat {formatDateTime(b.holdExpiresAt!)} saatine kadar ayrılı.{" "}
              <Link href={`/odeme/sonuc/${b.id}`} className="font-semibold underline">
                Ödemeyi tamamla
              </Link>
            </p>
          ))}
        </Alert>
      ) : null}

      {toReview.length ? (
        <Card className="mb-6 border-gold-300 bg-gold-50">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm text-slate-800">
              <Star className="size-4 fill-gold-400 text-gold-400" aria-hidden />
              {toReview.map((b) => b.teacher.user.firstName).join(", ")} ile dersiniz tamamlandı. Deneyiminizi paylaşır mısınız?
            </p>
            <LinkButton href={`/hesabim/derslerim/${toReview[0].id}`} variant="gold" size="sm">
              Değerlendir
            </LinkButton>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Yaklaşan dersler" action={<Link href="/hesabim/derslerim" className="text-sm font-semibold text-brand-700 hover:underline">Tümü</Link>} />
        <CardBody className="space-y-3">
          {upcoming.length ? (
            upcoming.map((b) => <BookingRow key={b.id} booking={b} href={`/hesabim/derslerim/${b.id}`} />)
          ) : (
            <EmptyState title="Yaklaşan dersiniz yok" description="Size uygun öğretmeni bulup ilk dersinizi planlayın." action={<LinkButton href="/ogretmenler">Öğretmen bul</LinkButton>} />
          )}
        </CardBody>
      </Card>
    </>
  );
}

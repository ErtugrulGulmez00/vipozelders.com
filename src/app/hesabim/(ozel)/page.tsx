import { GraduationCap, Inbox, MailWarning, Search, Star } from "lucide-react";
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
import { sideFacts } from "@/server/sides";
import { requesterInquiries } from "@/server/teacher-inquiries";
import { studentBookings, UPCOMING } from "@/server/student-queries";

export const metadata: Metadata = { title: "Hesabım" };

export default async function StudentHomePage() {
  const user = await requireRole("STUDENT");
  const now = new Date();
  const settings = await loadSettings();
  const [upcoming, awaitingPayment, toReview, inquiries, facts] = await Promise.all([
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
    requesterInquiries(user.id),
    sideFacts(user.id, user.role),
  ]);
  const bookingOpen = settings.lessonBookingEnabled;
  const pending = inquiries.filter((q) => q.status === "PENDING").length;
  const accepted = inquiries.filter((q) => q.status === "ACCEPTED").length;

  return (
    <>
      <PageHeader
        title={`Merhaba ${user.firstName}`}
        description="Ders taleplerinizi ve koçunuzun takibini buradan izleyebilirsiniz."
        actions={
          <LinkButton href="/ogretmenler">
            <Search className="size-4" aria-hidden /> Öğretmen bul
          </LinkButton>
        }
      />

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

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Ders taleplerim" action={<Link href="/hesabim/ders-talepleri" className="text-sm font-semibold text-brand-700 hover:underline">Tümü</Link>} />
          <CardBody>
            {inquiries.length ? (
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <Inbox className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <span>
                  {inquiries.length} talep{pending ? ` · ${pending} yanıt bekliyor` : ""}{accepted ? ` · ${accepted} kabul edildi` : ""}. Öğretmen kabul edince sizi arar; ücreti ve saati onunla konuşursunuz.
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-600">Beğendiğiniz öğretmenin profilinden ücretsiz ders talebi gönderin; öğretmen kabul edince sizi arar.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Koçum" />
          <CardBody>
            {facts.kocStudent ? (
              <p className="flex items-start gap-2 text-sm text-slate-700">
                <GraduationCap className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <span>
                  Haftalık program, ödevler, deneme sonuçları ve koçluk raporları.{" "}
                  <Link href="/kocum" className="font-semibold text-brand-700 hover:underline">
                    Koçum&apos;a git
                  </Link>
                </span>
              </p>
            ) : (
              <p className="text-sm text-slate-600">Öğretmeniniz talebinizi kabul edince çocuğunuz onun Pi Koç takibine eklenir; program, ödev ve deneme sonuçları burada görünür.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {!bookingOpen && !upcoming.length ? null : (
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
      )}
    </>
  );
}

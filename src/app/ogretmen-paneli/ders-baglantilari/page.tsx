import { Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact, formatLessonRange, toLocalDateString } from "@/lib/dates";
import { durationLabel } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { appUrl } from "@/server/email";
import { LINK_DURATIONS, MAKEUP_WINDOW_DAYS, makeupSources, NOTE_MIN_LENGTH } from "@/server/lesson-links";
import { CancelLinkButton, LessonLinkForm, LinkShare } from "./link-forms";

export const metadata: Metadata = { title: "Ders bağlantıları" };

export default async function TeacherLessonLinksPage({ searchParams }: PageProps<"/ogretmen-paneli/ders-baglantilari">) {
  const user = await requireRole("TEACHER");
  const { kaynak } = await searchParams;
  const now = new Date();
  const [teacher, sources, links] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({
      where: { userId: user.id },
      select: { freeLessonLinks: true, offerings: { include: { serviceType: true, level: true, subject: true } } },
    }),
    makeupSources(user.id, now),
    db.lessonLink.findMany({
      where: { teacherId: user.id },
      orderBy: { startAt: "desc" },
      take: 50,
      include: { booking: { select: { id: true, student: { select: { firstName: true, lastName: true } } } }, sourceBooking: { select: { id: true, code: true, learnerName: true, refundedAmount: true } } },
    }),
  ]);
  const free = teacher.freeLessonLinks;
  const defaultSource = typeof kaynak === "string" && sources.some((s) => s.id === kaynak) ? kaynak : undefined;

  return (
    <>
      <PageHeader
        title="Ders bağlantıları"
        description={
          free
            ? "Belirlediğiniz saat için ücretsiz ders bağlantısı oluşturun ve öğrencinize gönderin. Öğrenci bağlantıyı açıp giriş yapınca derse kaydolur; ders sanal sınıfta yapılır."
            : `Öğrencinin ücretini ödediği bir online dersi planlanan saatte yapamadıysanız ya da yapamayacaksanız, yeni randevu açtırmak yerine o ders için ücretsiz telafi bağlantısı oluşturun. Bağlantıyı yalnızca o dersin öğrencisi kullanabilir; her ücretli derse bir telafi açılır ve telafisi açılan dersin sınıfı kapanır.`
        }
      />

      <Card className="mb-6">
        <CardHeader title={free ? "Yeni ders bağlantısı" : "Yeni telafi bağlantısı"} description="Bağlantının saati takviminizde dolu görünür; öğrenci kaydolunca ders Derslerim'e düşer." />
        <CardBody>
          {!free && sources.length === 0 ? (
            <Alert tone="info">
              Telafi bağlantısı açılabilecek ücretli dersiniz yok. Bağlantı yalnızca son {MAKEUP_WINDOW_DAYS} gün içinde ücreti ödenmiş, iadesi yapılmamış ve yapılamamış bir online dersin telafisi için açılabilir (öğrenciyle ikiniz de sınıfa girdiyseniz ders yapılmış sayılır); ücret almadığınız biriyle ders için bağlantı açılamaz.
            </Alert>
          ) : (
            <LessonLinkForm
              free={free}
              offerings={teacher.offerings.map((o) => ({ value: o.id, label: `${o.level.name} ${o.subject.name} · ${o.serviceType.name}` }))}
              sources={sources.map((s) => ({ value: s.id, label: `${s.code} · ${s.learnerName} · ${s.levelName} ${s.subjectName} · ${formatCompact(s.startAt)}` }))}
              defaultSource={defaultSource}
              durations={LINK_DURATIONS.map((d) => ({ value: String(d), label: durationLabel(d) }))}
              today={toLocalDateString(now)}
              noteMin={NOTE_MIN_LENGTH}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Bağlantılarım" />
        {links.length === 0 ? (
          <EmptyState icon={<Link2 className="size-8" />} title="Henüz bağlantı yok" description="Oluşturduğunuz bağlantılar burada listelenir." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((link) => {
              const waiting = !link.booking && !link.cancelledAt && link.endAt > now;
              // Kaynak dersin ücreti sonradan iade edildiyse telafi kullanılamaz (iptal edip saati boşaltabilirsiniz)
              const voided = waiting && (link.sourceBooking?.refundedAmount ?? 0) > 0;
              const status = link.booking
                ? { label: "Kaydoldu", tone: "green" as const }
                : link.cancelledAt
                  ? { label: "İptal", tone: "slate" as const }
                  : link.endAt <= now
                    ? { label: "Süresi doldu", tone: "slate" as const }
                    : voided
                      ? { label: "Geçersiz: ders iade edildi", tone: "rose" as const }
                      : { label: "Bekliyor", tone: "amber" as const };
              return (
                <li key={link.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{formatLessonRange(link.startAt, link.endAt)}</p>
                      <p className="text-xs text-slate-500">
                        {link.levelName} {link.subjectName} · {link.serviceName}
                        {link.sourceBooking ? ` · ${link.sourceBooking.code} (${link.sourceBooking.learnerName}) telafisi` : ""}
                        {link.booking ? (
                          <>
                            {" · "}
                            <Link href={`/ogretmen-paneli/dersler/${link.booking.id}`} className="font-semibold text-brand-700 hover:underline">
                              {link.booking.student.firstName} {link.booking.student.lastName.charAt(0)}.
                            </Link>
                          </>
                        ) : null}
                      </p>
                      {link.note ? <p className="mt-1 text-xs text-slate-500">Not: {link.note}</p> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {waiting ? <CancelLinkButton linkId={link.id} /> : null}
                    </div>
                  </div>
                  {waiting && !voided ? <LinkShare url={appUrl(`/ders-baglantisi/${link.token}`)} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}

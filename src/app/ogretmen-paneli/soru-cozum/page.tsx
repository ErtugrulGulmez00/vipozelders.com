import { MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FlashNotice } from "@/components/panel/flash-notice";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact, formatLessonRange, toLocalDateString } from "@/lib/dates";
import { BOOKING_STATUS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { QUESTION_SESSION_MINUTES, questionSessionSources } from "@/server/lesson-links";
import { OpenQuestionSessionForm, QuestionSessionOfferForm } from "./question-session-forms";

export const metadata: Metadata = { title: "Soru çözüm dersleri" };

export default async function TeacherQuestionSessionsPage({ searchParams }: PageProps<"/ogretmen-paneli/soru-cozum">) {
  const user = await requireRole("TEACHER");
  const { durum } = await searchParams;
  const now = new Date();
  const [teacher, sources, opened] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { offersQuestionSession: true } }),
    questionSessionSources(user.id),
    db.lessonLink.findMany({
      where: { teacherId: user.id, isQuestionSession: true, bookingId: { not: null } },
      orderBy: { startAt: "desc" },
      take: 50,
      include: { booking: { select: { id: true, status: true, learnerName: true } } },
    }),
  ]);
  const today = toLocalDateString(now);

  return (
    <>
      <PageHeader title="Soru çözüm dersleri" description={`İsterseniz öğrencilerinize dersin yanında ${QUESTION_SESSION_MINUTES} dakikalık ücretsiz soru çözümü sunarsınız. Tamamen sizin tercihiniz.`} />
      <FlashNotice code={durum} />

      <Card className="mb-6">
        <CardHeader title="Tercihiniz" />
        <CardBody>
          <QuestionSessionOfferForm enabled={teacher.offersQuestionSession} />
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>Açıkken profilinizde ve öğretmen kartınızda görünür.</li>
            <li>Bu sırada alınan her ders tamamlanınca o öğrenciye {QUESTION_SESSION_MINUTES} dakikalık 1 ders açma hakkınız doğar.</li>
            <li>Bu ders için ücret alınmaz, hakediş oluşmaz ve hizmet bedeli kesilmez.</li>
            <li>Kapatırsanız yeni derslerde hak doğmaz; daha önce alınmış derslerin hakları durur, çünkü öğrenciye söz verilmiştir.</li>
          </ul>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader title={`Açabileceğiniz dersler (${sources.length})`} description="Saati seçin; ders hemen oluşur ve öğrenciye bildirim gider. İptal edilen dersin hakkı geri gelir." />
        {sources.length === 0 ? (
          <EmptyState icon={<MessageCircleQuestion className="size-8" />} title="Şu an açılacak ders yok" description="Taahhüdünüz açıkken alınan dersler tamamlandıkça burada listelenir." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sources.map((s) => (
              <li key={s.id} className="space-y-3 px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {s.learnerName}
                    {s.learnerGrade ? <span className="font-normal text-slate-500"> · {s.learnerGrade}</span> : null}
                  </p>
                  <p className="text-sm text-slate-600">
                    {s.levelName} {s.subjectName} · {formatCompact(s.startAt)} dersi ({s.code})
                  </p>
                </div>
                <OpenQuestionSessionForm bookingId={s.id} today={today} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Açtığınız dersler" />
        {opened.length === 0 ? (
          <EmptyState icon={<MessageCircleQuestion className="size-8" />} title="Henüz ders açmadınız" description="Açtığınız soru çözüm dersleri burada listelenir." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {opened.map((link) =>
              link.booking ? (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                  <div>
                    <Link href={`/ogretmen-paneli/dersler/${link.booking.id}`} className="font-medium text-brand-700 hover:underline">
                      {link.booking.learnerName}
                    </Link>
                    <p className="text-sm text-slate-600">{formatLessonRange(link.startAt, link.endAt)}</p>
                  </div>
                  <Badge tone={BOOKING_STATUS[link.booking.status]?.tone ?? "slate"}>{BOOKING_STATUS[link.booking.status]?.label ?? link.booking.status}</Badge>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Card>
    </>
  );
}

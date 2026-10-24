import { CalendarRange, MonitorPlay, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EnrollForm } from "@/components/groups/forms";
import { LinkButton } from "@/components/ui/button";
import { Alert, Avatar, Card, DescriptionList } from "@/components/ui/primitives";
import { formatDateTime, formatLessonRange } from "@/lib/dates";
import { scheduleSummary } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import { fullName, initials } from "@/lib/text";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { seatsTaken } from "@/server/groups";
import { salesOpen } from "@/server/payments/service";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = { title: "Grup dersi" };
export const instant = false;

export default async function GroupCoursePage({ params }: PageProps<"/grup-dersleri/[code]">) {
  const { code } = await params;
  const [user, course] = await Promise.all([
    getCurrentUser(),
    db.groupCourse.findUnique({
      where: { code },
      include: {
        sessions: { orderBy: { index: "asc" } },
        teacher: { select: { slug: true, photoKey: true, headline: true, status: true, user: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);
  if (!course || course.teacher.status !== "PUBLISHED") notFound();
  const now = new Date();
  const mine = user?.role === "STUDENT" ? await db.groupEnrollment.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId: user.id } } }) : null;
  // Davetle açılan ders yalnızca davet edilene görünür
  if (!course.isPublic && !mine && user?.id !== course.teacherId) notFound();
  const taken = await seatsTaken(course.id, now);
  const left = Math.max(0, course.capacity - taken);
  const open = course.status === "OPEN" && course.enrollDeadline > now;
  const teacherName = fullName(course.teacher.user);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-5">
        <div>
          <Link href="/grup-dersleri" className="text-sm text-brand-700 hover:underline">
            ← Grup dersleri
          </Link>
          <p className="mt-3 text-sm font-semibold text-brand-700">
            {course.levelName} · {course.subjectName} · grup dersi
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{course.title}</h1>
        </div>
        <Card className="flex items-center gap-3 p-4">
          <Avatar src={uploadUrl(course.teacher.photoKey)} name={teacherName} initials={initials(course.teacher.user)} size={48} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{teacherName}</p>
            {course.teacher.headline ? <p className="truncate text-sm text-slate-500">{course.teacher.headline}</p> : null}
          </div>
          <Link href={`/ogretmen/${course.teacher.slug}`} className="text-sm font-medium text-brand-700 hover:underline">
            Profil
          </Link>
        </Card>
        {course.description ? (
          <Card className="p-5">
            <p className="whitespace-pre-line text-slate-700">{course.description}</p>
          </Card>
        ) : null}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-slate-900">
            <CalendarRange className="size-5 text-brand-600" aria-hidden /> Program
          </h2>
          <p className="mt-1 text-sm text-slate-500">{scheduleSummary(course.sessions)}</p>
          <ol className="mt-3 space-y-1 text-sm text-slate-700">
            {course.sessions.map((s) => (
              <li key={s.id}>
                {s.index + 1}. {formatLessonRange(s.startAt, s.endAt)}
              </li>
            ))}
          </ol>
        </Card>
        <ul className="grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
          <li className="flex gap-2 rounded-xl bg-slate-50 p-3"><MonitorPlay className="size-4 shrink-0 text-brand-600" aria-hidden /> Dersler sitemizdeki sanal sınıfta; program kurmanız gerekmez.</li>
          <li className="flex gap-2 rounded-xl bg-slate-50 p-3"><Users className="size-4 shrink-0 text-brand-600" aria-hidden /> En az {course.minParticipants} kişi olursa açılır; olmazsa ücretin tamamı iade.</li>
          <li className="flex gap-2 rounded-xl bg-slate-50 p-3"><ShieldCheck className="size-4 shrink-0 text-brand-600" aria-hidden /> Öğretmenin katılmadığı oturumun ücreti iade edilir.</li>
        </ul>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <p>
            <span className="text-2xl font-bold text-slate-900">{formatMoney(course.price)}</span>
            <span className="text-sm text-slate-500"> / kişi, tüm program · KDV dahil</span>
          </p>
          <div className="mt-4">
            <DescriptionList
              items={[
                { label: "Kontenjan", value: `${course.capacity} kişi · ${left ? `${left} yer kaldı` : "doldu"}` },
                { label: "Son kayıt", value: formatDateTime(course.enrollDeadline) },
                { label: "İptal", value: "İlk dersten önce iptal ederseniz tam iade" },
              ]}
            />
          </div>
          <div className="mt-5">
            {mine?.status === "PAID" ? (
              <>
                <Alert tone="success">Bu derse kayıtlısınız.</Alert>
                <LinkButton href={`/hesabim/grup-derslerim/${mine.id}`} className="mt-3 w-full">
                  Kaydıma git
                </LinkButton>
              </>
            ) : !open ? (
              <Alert tone="info">Bu dersin kayıtları kapandı.</Alert>
            ) : !left ? (
              <Alert tone="info">Kontenjan doldu.</Alert>
            ) : !user ? (
              <LinkButton href="/giris" className="w-full" size="lg">
                Kayıt olmak için giriş yapın
              </LinkButton>
            ) : user.role !== "STUDENT" ? (
              <Alert tone="warning">Grup dersine yalnızca veli/öğrenci hesabıyla kayıt olunabilir.</Alert>
            ) : !salesOpen() ? (
              <Alert tone="info" title="Online ödeme çok yakında">Ödeme altyapımız açılınca buradan kayıt olabileceksiniz.</Alert>
            ) : (
              <EnrollForm courseId={course.id} label={`${formatMoney(course.price)} öde ve kayıt ol`} defaultName={mine?.learnerName ?? user.firstName} />
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelEnrollmentForm } from "@/components/groups/forms";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/primitives";
import { formatDateTime, formatLessonRange } from "@/lib/dates";
import { GROUP_COURSE_STATUS, GROUP_ENROLLMENT_STATUS, GROUP_SESSION_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Grup dersi" };

export default async function MyGroupPage({ params }: PageProps<"/hesabim/grup-derslerim/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const enrollment = await db.groupEnrollment.findUnique({
    where: { id },
    include: { course: { include: { sessions: { orderBy: { index: "asc" } }, teacher: { select: { slug: true, user: { select: { firstName: true, lastName: true } } } } } } },
  });
  if (!enrollment || enrollment.studentId !== user.id) notFound();
  const settings = await loadSettings();
  const now = new Date();
  const { course } = enrollment;
  const started = Boolean(course.sessions[0] && course.sessions[0].startAt <= now);
  const paid = enrollment.status === "PAID";
  const status = paid ? GROUP_COURSE_STATUS[course.status] : GROUP_ENROLLMENT_STATUS[enrollment.status];

  return (
    <div className="space-y-5">
      <Link href="/hesabim/grup-derslerim" className="text-sm text-brand-700 hover:underline">
        ← Grup derslerim
      </Link>
      <Card>
        <CardHeader title={course.title} description={`${course.levelName} ${course.subjectName} · ${fullName(course.teacher.user)}`} action={<Badge tone={status?.tone}>{status?.label}</Badge>} />
        <CardBody className="space-y-4">
          {paid && course.status === "OPEN" ? (
            <Alert tone="info">Ders, {formatDateTime(course.enrollDeadline)} tarihine kadar en az {course.minParticipants} kişiye ulaşınca kesinleşir. Ulaşmazsa ödediğiniz ücretin tamamı kartınıza iade edilir.</Alert>
          ) : null}
          {course.status === "CANCELLED" ? <Alert tone="warning">Ders iptal edildi{course.cancelReason ? `: ${course.cancelReason}` : ""}. Yapılmamış oturumların ücreti iade edildi.</Alert> : null}
          <DescriptionList
            items={[
              { label: "Kayıt no", value: enrollment.code },
              { label: "Öğrenci", value: enrollment.learnerName ?? "—" },
              { label: "Ücret", value: formatMoney(enrollment.price) },
              ...(enrollment.refundedAmount ? [{ label: "İade", value: formatMoney(enrollment.refundedAmount) }] : []),
            ]}
          />
          {(enrollment.status === "PAID" && !started && (course.status === "OPEN" || course.status === "CONFIRMED")) || enrollment.status === "INVITED" ? (
            <CancelEnrollmentForm id={enrollment.id} paid={enrollment.status === "PAID"} />
          ) : null}
          {paid && started ? <p className="text-xs text-slate-500">Ders başladığı için kayıt iptal edilemez; öğretmenin katılmadığı oturumların ücreti otomatik iade edilir.</p> : null}
        </CardBody>
      </Card>

      {paid ? (
        <Card>
          <CardHeader title="Oturumlar" description={`“Derse katıl” düğmesi ders saatinden ${settings.classroomOpensMinutesBefore} dakika önce açılır. Mikrofonunuz kapalı başlar; söz almak için açabilirsiniz.`} />
          <ul className="divide-y divide-slate-100">
            {course.sessions.map((s) => {
              const st = GROUP_SESSION_STATUS[s.status];
              const opensAt = new Date(s.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
              const live = course.status === "CONFIRMED" && s.status === "SCHEDULED" && opensAt <= now && s.endAt > now;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium text-slate-900">{s.index + 1}. oturum</span> · {formatLessonRange(s.startAt, s.endAt)}
                  </span>
                  {live ? (
                    <Link href={`/grup-ders/${s.id}`} className={buttonClasses("primary", "sm")}>
                      Derse katıl
                    </Link>
                  ) : (
                    <Badge tone={st?.tone}>{st?.label}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

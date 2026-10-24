import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelCourseForm, InviteForm } from "@/components/groups/forms";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState } from "@/components/ui/primitives";
import { formatDateTime, formatLessonRange } from "@/lib/dates";
import { GROUP_COURSE_STATUS, GROUP_ENROLLMENT_STATUS, GROUP_SESSION_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { shortName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Grup dersi" };

export default async function TeacherGroupPage({ params }: PageProps<"/ogretmen-paneli/grup-dersleri/[id]">) {
  const user = await requireRole("TEACHER");
  const { id } = await params;
  const course = await db.groupCourse.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { index: "asc" }, include: { _count: { select: { attendance: true } } } },
      enrollments: { where: { status: { in: ["PAID", "INVITED", "PENDING_PAYMENT"] } }, include: { student: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!course || course.teacherId !== user.id) notFound();
  const settings = await loadSettings();
  const now = new Date();
  const paid = course.enrollments.filter((e) => e.status === "PAID");
  const others = course.enrollments.filter((e) => e.status !== "PAID");
  const started = Boolean(course.sessions[0] && course.sessions[0].startAt <= now);
  const status = GROUP_COURSE_STATUS[course.status];
  const net = paid.reduce((t, e) => t + e.teacherAmount, 0);

  return (
    <div className="space-y-5">
      <Link href="/ogretmen-paneli/grup-dersleri" className="text-sm text-brand-700 hover:underline">
        ← Grup dersleri
      </Link>

      <Card>
        <CardHeader title={course.title} description={`${course.code} · ${course.levelName} ${course.subjectName}`} action={<Badge tone={status?.tone}>{status?.label ?? course.status}</Badge>} />
        <CardBody className="space-y-4">
          {course.status === "OPEN" ? (
            <Alert tone={paid.length >= course.minParticipants ? "success" : "info"}>
              {paid.length >= course.minParticipants
                ? `En az katılımcı sayısına ulaşıldı. Kayıtlar ${formatDateTime(course.enrollDeadline)} tarihinde kapanınca ders kesinleşir.`
                : `${paid.length}/${course.minParticipants} kişi. ${formatDateTime(course.enrollDeadline)} tarihine kadar en az ${course.minParticipants} kişi kayıt olmazsa ders iptal olur ve ödemeler iade edilir.`}
            </Alert>
          ) : null}
          {course.cancelReason ? <Alert tone="warning">İptal gerekçesi: {course.cancelReason}</Alert> : null}
          <DescriptionList
            items={[
              { label: "Kişi başı ücret", value: `${formatMoney(course.price)} (size kalan ${formatMoney(paid[0]?.teacherAmount ?? Math.round(course.price * (1 - course.commissionRateBps / 10_000)))})` },
              { label: "Kayıt", value: `${paid.length}/${course.capacity} kişi · en az ${course.minParticipants}` },
              { label: "Kayıt bitişi", value: formatDateTime(course.enrollDeadline) },
              { label: "Toplam hakediş", value: `${formatMoney(net)} · her oturum yapıldıkça payı serbest kalır` },
              { label: "Görünürlük", value: course.isPublic ? "Sitede yayında" : "Yalnızca davetle" },
            ]}
          />
          {course.isPublic && course.status === "OPEN" ? (
            <p className="text-sm text-slate-600">
              Paylaşım bağlantısı: <Link href={`/grup-dersleri/${course.code}`} className="font-medium text-brand-700 underline">pikampus.com/grup-dersleri/{course.code}</Link>
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Oturumlar" description={`Sanal sınıf ders saatinden ${settings.classroomOpensMinutesBefore} dakika önce açılır. Katılmadığınız oturumun ücreti öğrencilere iade edilir.`} />
        <ul className="divide-y divide-slate-100">
          {course.sessions.map((s) => {
            const st = GROUP_SESSION_STATUS[s.status];
            const joinable = course.status === "CONFIRMED" && s.status === "SCHEDULED" && s.endAt > now;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{s.index + 1}. oturum</span> · {formatLessonRange(s.startAt, s.endAt)}
                  {s.status === "COMPLETED" ? <span className="text-xs text-slate-500"> · {s._count.attendance} giriş</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={st?.tone}>{st?.label ?? s.status}</Badge>
                  {joinable ? (
                    <Link href={`/grup-ders/${s.id}`} className={buttonClasses("primary", "sm")}>
                      Sınıfa gir
                    </Link>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title={`Öğrenciler (${paid.length})`} />
        {paid.length === 0 ? (
          <EmptyState title="Henüz kayıt yok" description={course.isPublic ? "Ders sitedeki grup dersleri listesinde görünüyor; bağlantıyı da paylaşabilirsiniz." : "Öğrencilerinizi aşağıdan davet edin."} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {paid.map((e) => (
              <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>
                  <span className="font-medium text-slate-900">{e.learnerName || shortName(e.student)}</span>
                  <span className="text-xs text-slate-500"> · veli/öğrenci hesabı: {shortName(e.student)}</span>
                </span>
                <span className="text-xs text-slate-500">{e.code}</span>
              </li>
            ))}
          </ul>
        )}
        {others.length ? (
          <CardBody className="border-t border-slate-100">
            <p className="mb-2 text-sm font-semibold text-slate-800">Davetler ve bekleyen ödemeler</p>
            <ul className="space-y-1 text-sm">
              {others.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{shortName(e.student)}</span>
                  <Badge tone={GROUP_ENROLLMENT_STATUS[e.status]?.tone}>{GROUP_ENROLLMENT_STATUS[e.status]?.label}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : null}
        {course.status === "OPEN" && course.enrollDeadline > now ? (
          <CardBody className="border-t border-slate-100">
            <InviteForm courseId={course.id} />
          </CardBody>
        ) : null}
      </Card>

      {(course.status === "OPEN" || course.status === "CONFIRMED") && !started ? (
        <Card>
          <CardHeader title="Dersi iptal et" description="İlk oturum başlamadan iptal edebilirsiniz; ödeme yapan herkese tam iade yapılır. Sık iptal profilinizi olumsuz etkiler." />
          <CardBody>
            <CancelCourseForm courseId={course.id} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

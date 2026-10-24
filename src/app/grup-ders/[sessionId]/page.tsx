import { Clock, MonitorX, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Classroom } from "@/app/ders/[bookingId]/classroom";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { groupClassroomAccess, recordGroupVisit } from "@/server/groups";
import { createRoomToken, videoConfigured } from "@/server/video";

export const metadata: Metadata = { title: "Grup dersi · sanal sınıf" };
export const instant = false;

export default async function GroupClassroomPage({ params }: PageProps<"/grup-ders/[sessionId]">) {
  const user = await requireUser();
  const { sessionId } = await params;
  const access = await groupClassroomAccess(sessionId, user.id);
  let backHref = "/hesabim/grup-derslerim";
  if (access.ok && access.role === "teacher") backHref = `/ogretmen-paneli/grup-dersleri/${access.course.id}`;
  else if (access.ok) {
    const enrollment = await db.groupEnrollment.findFirst({ where: { courseId: access.course.id, studentId: user.id }, select: { id: true } });
    if (enrollment) backHref = `/hesabim/grup-derslerim/${enrollment.id}`;
  } else if (user.role === "TEACHER") backHref = "/ogretmen-paneli/grup-dersleri";

  if (!access.ok) {
    return (
      <Message icon={access.opensAt ? <Clock className="size-10 text-brand-400" /> : <MonitorX className="size-10 text-slate-400" />} title={access.reason} backHref={backHref}>
        {access.opensAt ? <p className="text-slate-300">Sınıf {formatDateTime(access.opensAt)} saatinde açılacak. Bu sayfayı o saatte yenileyin.</p> : null}
      </Message>
    );
  }

  await recordGroupVisit(sessionId, user.id);
  const title = `${access.course.title} · ${access.session.index + 1}. oturum`;
  if (!videoConfigured()) {
    return (
      <Message icon={<Video className="size-10 text-brand-400" />} title="Sanal sınıf henüz yapılandırılmadı" backHref={backHref}>
        <p className="text-slate-300">Görüntülü görüşme sunucusu bağlanınca ders burada açılacak.</p>
      </Message>
    );
  }
  const { token, serverUrl } = await createRoomToken({ room: access.session.videoRoomName, role: access.role, closesAt: access.closesAt }, user);
  return <Classroom token={token} serverUrl={serverUrl} title={title} endsAt={access.session.endAt.getTime()} backHref={backHref} teacherNotice={access.role === "teacher"} startMuted={access.role === "student"} />;
}

function Message({ icon, title, children, backHref }: { icon: React.ReactNode; title: string; children?: React.ReactNode; backHref: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 text-center">
      {icon}
      <h1 className="mt-4 text-xl font-bold text-white">{title}</h1>
      <div className="mt-2 max-w-lg text-sm">{children}</div>
      <Link href={backHref} className={buttonClasses("outline", "md", "mt-6")}>
        Ders sayfasına dön
      </Link>
    </div>
  );
}

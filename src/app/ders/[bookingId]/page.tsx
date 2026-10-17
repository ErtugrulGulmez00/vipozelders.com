import { Clock, MonitorX, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";
import { requireUser } from "@/server/auth/current-user";
import { classroomAccess, createClassroomToken, recordClassroomVisit, videoConfigured } from "@/server/video";
import { Classroom } from "./classroom";

export const metadata: Metadata = { title: "Sanal sınıf" };
export const instant = false;

export default async function ClassroomPage({ params, searchParams }: PageProps<"/ders/[bookingId]">) {
  const user = await requireUser();
  const { bookingId } = await params;
  const { izle } = await searchParams;
  const access = await classroomAccess(bookingId, user.id);
  const backHref = user.role === "TEACHER" ? `/ogretmen-paneli/dersler/${bookingId}` : `/hesabim/derslerim/${bookingId}`;

  if (!access.ok) {
    return (
      <Message icon={access.opensAt ? <Clock className="size-10 text-brand-400" /> : <MonitorX className="size-10 text-slate-400" />} title={access.reason} backHref={backHref}>
        {access.opensAt ? <p className="text-slate-300">Sınıf {formatDateTime(access.opensAt)} saatinde açılacak. Bu sayfayı o saatte yenileyin.</p> : null}
      </Message>
    );
  }

  // Veli izleyici modu: öğrenci hesabıyla ikinci cihazdan, görünmeden izleme
  const observer = izle === "1" && access.role === "student";
  if (!observer) await recordClassroomVisit(bookingId, user.id);
  const title = `${access.booking.levelName} ${access.booking.subjectName} · ${access.booking.learnerName}`;

  if (!videoConfigured()) {
    return (
      <Message icon={<Video className="size-10 text-brand-400" />} title="Sanal sınıf henüz yapılandırılmadı" backHref={backHref}>
        <p className="text-slate-300">
          Ders odası hazır ({access.booking.videoRoomName}), ancak görüntülü görüşme sunucusu bağlanmadı. Site yöneticisi .env dosyasına LIVEKIT_URL, LIVEKIT_API_KEY ve LIVEKIT_API_SECRET değerlerini girdiğinde ders burada açılacak.
        </p>
      </Message>
    );
  }

  const { token, serverUrl } = await createClassroomToken(access, user, new Date(), { observer });
  return <Classroom token={token} serverUrl={serverUrl} title={observer ? `İzleyici · ${title}` : title} endsAt={access.booking.endAt.getTime()} backHref={backHref} bookingId={bookingId} observer={observer} />;
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

import { MonitorX, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Classroom } from "@/app/ders/[bookingId]/classroom";
import { buttonClasses } from "@/components/ui/button";
import { requireUser } from "@/server/auth/current-user";
import { announceMeeting, meetingAccess, meetingToken } from "@/server/koc-meeting";
import { coachMeetingAllowance } from "@/server/koc-meeting-usage";
import { videoConfigured } from "@/server/video";

export const metadata: Metadata = { title: "Online görüşme", robots: { index: false } };
export const instant = false;

/** Pi Koç online görüşme: koç ve öğrencisi (ya da velisi) sitedeki sanal sınıfta görüşür. */
export default async function KocMeetingPage({ params }: PageProps<"/gorusme/[studentId]">) {
  await connection();
  const user = await requireUser();
  const { studentId } = await params;
  const access = await meetingAccess(user.id, studentId);
  if (!access.ok) {
    return (
      <Message icon={<MonitorX className="size-10 text-slate-400" />} title="Bu görüşme odasına giremezsiniz" backHref="/koc-giris">
        <p className="text-slate-300">Görüşme odasını yalnızca öğrencinin koçu, öğrencinin kendisi ve bağlı velisi açabilir.</p>
      </Message>
    );
  }
  const title = `Koç görüşmesi · ${access.student.firstName} ${access.student.lastName}`;
  if (!videoConfigured()) {
    return (
      <Message icon={<Video className="size-10 text-brand-400" />} title="Görüntülü görüşme henüz yapılandırılmadı" backHref={access.backHref}>
        <p className="text-slate-300">Görüşme odası hazır, ancak görüntülü görüşme sunucusu bağlanmadı. Site yöneticisi LIVEKIT ayarlarını girince görüşme burada açılır.</p>
      </Message>
    );
  }
  // Paket sınırı: ücretsiz pakette aylık süre dolduysa görüşme açılmaz; anahtar süresi kalan süreyle sınırlı
  const allowance = await coachMeetingAllowance(studentId);
  if (!allowance.ok) {
    return (
      <Message icon={<MonitorX className="size-10 text-brand-400" />} title="Görüşme süresi doldu" backHref={access.role === "teacher" ? "/koc/abonelik" : access.backHref}>
        <p className="text-slate-300">{access.role === "teacher" ? allowance.reason : "Koçunuzun bu ayki görüşme süresi doldu. Koçunuzla iletişime geçin."}</p>
      </Message>
    );
  }
  if (access.role === "teacher") await announceMeeting(studentId, `${user.firstName} ${user.lastName}`);
  const { token, serverUrl, endsAt } = await meetingToken(studentId, access.role, user, allowance.minutes);
  return <Classroom token={token} serverUrl={serverUrl} title={title} endsAt={endsAt} backHref={access.backHref} />;
}

function Message({ icon, title, children, backHref }: { icon: React.ReactNode; title: string; children?: React.ReactNode; backHref: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 text-center">
      {icon}
      <h1 className="mt-4 text-xl font-bold text-white">{title}</h1>
      <div className="mt-2 max-w-lg text-sm">{children}</div>
      <Link href={backHref} className={buttonClasses("outline", "md", "mt-6")}>
        Geri dön
      </Link>
    </div>
  );
}

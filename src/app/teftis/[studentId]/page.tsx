import { MonitorX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Classroom } from "@/app/ders/[bookingId]/classroom";
import { buttonClasses } from "@/components/ui/button";
import { audit } from "@/server/audit";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { meetingRoomName } from "@/server/koc-meeting";
import { createRoomToken, videoConfigured } from "@/server/video";

export const metadata: Metadata = { title: "Teftiş izleme", robots: { index: false } };
export const instant = false;

/** Yönetimin teftiş izlemesi: süren görüşmeye görünmez katılım (yayın yok, bildirim yok, süreye sayılmaz). */
export default async function InspectMeetingPage({ params }: PageProps<"/teftis/[studentId]">) {
  await connection();
  const admin = await requireRole("ADMIN");
  const { studentId } = await params;
  const [meeting, student] = await Promise.all([
    db.coachMeeting.findFirst({ where: { roomName: meetingRoomName(studentId), endedAt: null }, select: { id: true } }),
    db.centerStudent.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true, center: { select: { name: true } } } }),
  ]);
  if (!meeting || !student || !videoConfigured()) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 text-center">
        <MonitorX className="size-10 text-brand-400" aria-hidden />
        <h1 className="mt-4 text-xl font-bold text-white">Görüşme şu an sürmüyor</h1>
        <Link href="/yonetim/canli-gorusmeler" className={buttonClasses("outline", "md", "mt-6")}>
          Canlı görüşmeler
        </Link>
      </div>
    );
  }
  const now = new Date();
  const closesAt = new Date(now.getTime() + 2 * 60 * 60_000);
  const { token, serverUrl } = await createRoomToken({ room: meetingRoomName(studentId), role: "student", closesAt }, admin, now, { inspector: true });
  await audit({ actorId: admin.id, action: "meeting.inspect", entityType: "CoachMeeting", entityId: meeting.id, details: { studentId } });
  return (
    <Classroom
      token={token}
      serverUrl={serverUrl}
      title={`Teftiş izleme · ${student.firstName} ${student.lastName} · ${student.center.name}`}
      endsAt={closesAt.getTime()}
      backHref="/yonetim/canli-gorusmeler"
      observer
    />
  );
}

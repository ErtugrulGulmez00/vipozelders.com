import type { Metadata } from "next";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { requireUser } from "@/server/auth/current-user";
import { meetingAccess, meetingBoardToken, meetingLive } from "@/server/koc-meeting";
import { coachMeetingAllowance } from "@/server/koc-meeting-usage";
import { videoConfigured } from "@/server/video";
import { BoardRoom } from "./board-room";

export const metadata: Metadata = { title: "Beyaz tahta", robots: { index: false } };
export const instant = false;

/** Koç görüşmesinin yalnızca tahta görünümü (mobil uygulamanın görüşme ekranı içinde açılır). */
export default async function MeetingBoardPage({ params }: PageProps<"/gorusme/[studentId]/tahta">) {
  await connection();
  const user = await requireUser();
  const { studentId } = await params;
  const access = await meetingAccess(user.id, studentId);
  if (!access.ok) return <Message text="Bu görüşmenin tahtasını açamazsınız." />;
  if (!videoConfigured()) return <Message text="Görüntülü görüşme henüz yapılandırılmadı." />;
  const allowance = await coachMeetingAllowance(studentId);
  if (!allowance.ok) return <Message text="Görüşme süresi doldu; tahta açılamıyor." />;
  if (access.role === "student" && !(await meetingLive(studentId))) {
    return (
      <Message text="Koçunuz görüşmeyi başlatınca tahta burada açılır.">
        <AutoRefresh intervalMs={8_000} maxMs={30 * 60_000} />
      </Message>
    );
  }
  const { token, serverUrl } = await meetingBoardToken(studentId, access.role, user, allowance.minutes);
  return <BoardRoom token={token} serverUrl={serverUrl} />;
}

function Message({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-6 text-center text-sm text-slate-600">
      <p>{text}</p>
      {children}
    </div>
  );
}

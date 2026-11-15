import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThreadView } from "@/components/panel/thread-view";
import { requireRole } from "@/server/auth/current-user";
import { loadThread } from "@/server/messages";
import { PlatformRules } from "@/components/teacher/platform-rules";
import { SafetyMenu } from "@/components/panel/safety-menu";
import { hasBlocked, isBlockedBetween } from "@/server/safety";

export const metadata: Metadata = { title: "Mesaj" };

export default async function TeacherThreadPage({ params }: PageProps<"/ogretmen-paneli/mesajlar/[id]">) {
  const user = await requireRole("TEACHER");
  const { id } = await params;
  const thread = await loadThread(id, user.id);
  if (!thread) notFound();
  const other = thread.student;
  const [blockedByMe, blocked] = await Promise.all([hasBlocked(user.id, other.id), isBlockedBetween(user.id, other.id)]);
  return (
    <div className="space-y-4">
      <Link href="/ogretmen-paneli/mesajlar" className="text-sm text-brand-700 hover:underline">
        ← Mesajlar
      </Link>
      <PlatformRules />
      <ThreadView
        thread={thread}
        viewerId={user.id}
        viewer="teacher"
        safety={<SafetyMenu targetUserId={other.id} targetName={`${other.firstName} ${other.lastName.charAt(0)}.`} kind="thread" refId={thread.id} blocked={blockedByMe} />}
        closedNote={blocked ? (blockedByMe ? "Bu kişiyi engellediniz. Yazışmak için engeli kaldırın." : "Bu konuşmaya artık mesaj gönderilemiyor.") : null}
      />
    </div>
  );
}

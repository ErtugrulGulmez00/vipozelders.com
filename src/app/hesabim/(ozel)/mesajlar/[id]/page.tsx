import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThreadView } from "@/components/panel/thread-view";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/server/auth/current-user";
import { loadThread } from "@/server/messages";
import { SafetyMenu } from "@/components/panel/safety-menu";
import { hasBlocked, isBlockedBetween } from "@/server/safety";

export const metadata: Metadata = { title: "Mesaj" };

export default async function StudentThreadPage({ params }: PageProps<"/hesabim/mesajlar/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const thread = await loadThread(id, user.id);
  if (!thread) notFound();
  const slug = thread.teacher.teacherProfile?.slug;
  const other = thread.teacher;
  const [blockedByMe, blocked] = await Promise.all([hasBlocked(user.id, other.id), isBlockedBetween(user.id, other.id)]);
  return (
    <div className="space-y-4">
      <Link href="/hesabim/mesajlar" className="text-sm text-brand-700 hover:underline">
        ← Mesajlar
      </Link>
      <ThreadView
        thread={thread}
        viewerId={user.id}
        viewer="student"
        safety={<SafetyMenu targetUserId={other.id} targetName={`${other.firstName} ${other.lastName}`} kind="thread" refId={thread.id} blocked={blockedByMe} />}
        closedNote={blocked ? (blockedByMe ? "Bu öğretmeni engellediniz. Yazışmak için engeli kaldırın." : "Bu konuşmaya artık mesaj gönderilemiyor.") : null}
        action={slug ? <LinkButton href={`/ogretmen/${slug}`} size="sm" variant="outline">Profil ve ders saatleri</LinkButton> : null}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThreadView } from "@/components/panel/thread-view";
import { LinkButton } from "@/components/ui/button";
import { requireRole } from "@/server/auth/current-user";
import { loadThread } from "@/server/messages";

export const metadata: Metadata = { title: "Mesaj" };

export default async function StudentThreadPage({ params }: PageProps<"/hesabim/mesajlar/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const thread = await loadThread(id, user.id);
  if (!thread) notFound();
  const slug = thread.teacher.teacherProfile?.slug;
  return (
    <div className="space-y-4">
      <Link href="/hesabim/mesajlar" className="text-sm text-brand-700 hover:underline">
        ← Mesajlar
      </Link>
      <ThreadView
        thread={thread}
        viewerId={user.id}
        viewer="student"
        action={slug ? <LinkButton href={`/ogretmen/${slug}`} size="sm" variant="outline">Profil ve ders saatleri</LinkButton> : null}
      />
    </div>
  );
}

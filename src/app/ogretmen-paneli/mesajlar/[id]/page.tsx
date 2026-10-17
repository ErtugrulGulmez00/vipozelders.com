import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ThreadView } from "@/components/panel/thread-view";
import { requireRole } from "@/server/auth/current-user";
import { loadThread } from "@/server/messages";

export const metadata: Metadata = { title: "Mesaj" };

export default async function TeacherThreadPage({ params }: PageProps<"/ogretmen-paneli/mesajlar/[id]">) {
  const user = await requireRole("TEACHER");
  const { id } = await params;
  const thread = await loadThread(id, user.id);
  if (!thread) notFound();
  return (
    <div className="space-y-4">
      <Link href="/ogretmen-paneli/mesajlar" className="text-sm text-brand-700 hover:underline">
        ← Mesajlar
      </Link>
      <ThreadView thread={thread} viewerId={user.id} viewer="teacher" />
    </div>
  );
}

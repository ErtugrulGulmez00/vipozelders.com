import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/dates";
import type { listThreads, loadThread } from "@/server/messages";
import { MessageForm } from "./message-forms";

type Thread = NonNullable<Awaited<ReturnType<typeof loadThread>>>;
type ThreadRow = Awaited<ReturnType<typeof listThreads>>[number];

type Person = { firstName: string; lastName: string };

/** Öğretmenin tam adı, velinin/öğrencinin soyadının baş harfi gösterilir. */
export function threadTitle(thread: { student: Person; teacher: Person }, viewer: "student" | "teacher") {
  return viewer === "student" ? `${thread.teacher.firstName} ${thread.teacher.lastName}` : `${thread.student.firstName} ${thread.student.lastName.charAt(0)}.`;
}

export function ThreadList({ threads, viewer, basePath }: { threads: ThreadRow[]; viewer: "student" | "teacher"; basePath: string }) {
  if (!threads.length) {
    return (
      <Card>
        <EmptyState
          icon={<MessageCircle className="size-8" />}
          title="Henüz mesaj yok"
          description={viewer === "student" ? "Öğretmen profillerindeki “mesaj gönder” ile ders öncesi sorularınızı sorabilirsiniz." : "Veliler profilinizden mesaj gönderdiğinde burada görünür."}
        />
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-slate-100">
      {threads.map((t) => (
        <Link key={t.id} href={`${basePath}/${t.id}`} className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-slate-50">
          <div className="min-w-0">
            <p className={cn("text-slate-900", t.unread ? "font-bold" : "font-medium")}>{threadTitle(t, viewer)}</p>
            <p className="truncate text-sm text-slate-500">{t.last?.body ?? ""}</p>
          </div>
          <div className="shrink-0 text-right text-xs text-slate-400">
            {t.last ? formatCompact(t.last.createdAt) : ""}
            {t.unread ? <span className="mt-1 block font-semibold text-brand-700">Yeni</span> : null}
          </div>
        </Link>
      ))}
    </Card>
  );
}

export function ThreadView({ thread, viewerId, viewer, action }: { thread: Thread; viewerId: string; viewer: "student" | "teacher"; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={threadTitle(thread, viewer)} action={action} />
      <CardBody className="space-y-4">
        <ol className="space-y-2">
          {thread.messages.map((m) => {
            const mine = m.authorId === viewerId;
            return (
              <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm", mine ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800")}>
                  <p className="whitespace-pre-line">{m.body}</p>
                  <p className={cn("mt-1 text-[11px]", mine ? "text-brand-100" : "text-slate-400")}>{formatCompact(m.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <MessageForm threadId={thread.id} />
      </CardBody>
    </Card>
  );
}

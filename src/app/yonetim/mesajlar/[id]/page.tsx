import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";
import { ModerateThreadForm } from "../moderate-form";

export const metadata: Metadata = { title: "Konuşma denetimi" };

const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

/** Yönetici konuşmayı salt okunur görür (taraflar için "okundu" işaretlenmez); gizlenen mesajların aslı da görünür. */
export default async function ThreadModerationPage({ params }: PageProps<"/yonetim/mesajlar/[id]">) {
  const { id } = await params;
  const thread = await db.messageThread.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      teacher: { select: { id: true, firstName: true, lastName: true, teacherProfile: { select: { status: true, slug: true } } } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) notFound();
  const pending = thread.flaggedAt && (!thread.reviewedAt || thread.reviewedAt < thread.flaggedAt);
  const suspended = thread.teacher.teacherProfile?.status === "SUSPENDED";

  return (
    <div className="space-y-5">
      <Link href="/yonetim/mesajlar" className="text-sm text-brand-700 hover:underline">
        ← Mesaj denetimi
      </Link>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader
            title={`${name(thread.teacher)} ↔ ${name(thread.student)}`}
            description={`Öğretmen: ${name(thread.teacher)} · Veli: ${name(thread.student)} (${thread.student.email ?? "e-posta yok"})`}
            action={suspended ? <Badge tone="rose">Öğretmen askıda</Badge> : null}
          />
          <CardBody>
            <ol className="space-y-3">
              {thread.messages.map((m) => {
                const byTeacher = m.authorId === thread.teacher.id;
                return (
                  <li key={m.id} className={cn("rounded-xl p-3 text-sm", m.flagReason ? "bg-rose-50 ring-1 ring-rose-200" : byTeacher ? "bg-brand-50/60" : "bg-slate-50")}>
                    <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{byTeacher ? `Öğretmen · ${thread.teacher.firstName}` : `Veli · ${thread.student.firstName}`}</span>
                      <span>{formatCompact(m.createdAt)}</span>
                      {m.flagReason ? <Badge tone="rose">{m.flagReason}</Badge> : null}
                    </p>
                    <p className="whitespace-pre-line text-slate-800">{m.body}</p>
                    {m.originalBody ? (
                      <p className="mt-2 whitespace-pre-line rounded-lg bg-white p-2 text-xs text-rose-800">
                        <strong>Gizlenmeden önceki hâli (yalnızca yönetici görür):</strong> {m.originalBody}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Karar" description={pending ? "Bu konuşmada incelenmemiş şüpheli mesaj var." : thread.reviewedAt ? `Son inceleme: ${formatCompact(thread.reviewedAt)}` : "İşaretli mesaj yok."} />
          <CardBody className="space-y-3">
            {pending ? <Alert tone="warning">Öğretmene otomatik uyarı gitti. Kanıt yeterliyse resmî uyarı verin ya da askıya alın.</Alert> : null}
            <ModerateThreadForm threadId={thread.id} teacherSuspended={suspended} />
            <Link href={`/yonetim/ogretmenler/${thread.teacher.id}`} className="block text-sm font-medium text-brand-700 hover:underline">
              Öğretmenin yönetim sayfası
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import { MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { POOL_STATUS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { creditBalance } from "@/server/credits";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Sorularım" };

export default async function MyQuestionsPage() {
  const user = await requireRole("STUDENT");
  const [questions, balance] = await Promise.all([
    db.poolQuestion.findMany({ where: { studentId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    creditBalance(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Sorularım"
        description={`Fotoğrafla gönderdiğiniz sorular ve çözümleri. Kalan krediniz: ${balance}.`}
        actions={
          <LinkButton href="/soru-sor">
            <MessageCircleQuestion className="size-4" aria-hidden /> Soru sor
          </LinkButton>
        }
      />
      {questions.length === 0 ? (
        <EmptyState
          icon={<MessageCircleQuestion className="size-8" />}
          title="Henüz soru göndermediniz"
          description="Takıldığınız sorunun fotoğrafını çekin; öğretmenlerimiz adım adım çözsün."
          action={<LinkButton href="/soru-sor">Soru sor</LinkButton>}
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {questions.map((q) => {
            const status = POOL_STATUS[q.status];
            return (
              <Link key={q.id} href={`/hesabim/sorularim/${q.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">
                    {q.levelName} · {q.subjectName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {q.code} · {formatCompact(q.createdAt)}
                    {q.followUpText && !q.followUpAnswer ? " · ek sorunuz bekliyor" : ""}
                  </p>
                </div>
                <Badge tone={status?.tone}>{status?.label ?? q.status}</Badge>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}

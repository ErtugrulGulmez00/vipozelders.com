import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelQuestionForm, DisputeForm, FollowUpForm, RatingForm } from "@/components/panel/pool-forms";
import { PoolQuestionView } from "@/components/panel/pool-question-view";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Soru" };

export default async function MyQuestionPage({ params }: PageProps<"/hesabim/sorularim/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const question = await db.poolQuestion.findUnique({ where: { id } });
  if (!question || question.studentId !== user.id) notFound();
  const now = new Date();
  const answered = question.status === "ANSWERED" || question.status === "CLOSED";
  const inWindow = question.status === "ANSWERED" && Boolean(question.disputeUntil && question.disputeUntil > now);

  return (
    <div className="space-y-5">
      <Link href="/hesabim/sorularim" className="text-sm text-brand-700 hover:underline">
        ← Sorularım
      </Link>

      {question.status === "OPEN" || question.status === "CLAIMED" ? (
        <Alert tone="info" title={question.status === "CLAIMED" ? "Bir öğretmen sorunuzu çözüyor" : "Sorunuz öğretmen bekliyor"}>
          Çözüm en geç {formatDateTime(question.expiresAt)} saatine kadar gelecek; gelmezse krediniz otomatik iade edilir. Çözüm gelince bildirim alacaksınız.
        </Alert>
      ) : null}

      <PoolQuestionView question={question} viewer="student" />

      {question.status === "OPEN" ? (
        <div className="flex justify-end">
          <CancelQuestionForm id={question.id} />
        </div>
      ) : null}

      {answered ? (
        <Card>
          <CardHeader title="Çözüm nasıldı?" description="Puanınız öğretmenlerin kalitesini takip etmemize yardım eder." />
          <CardBody>
            <RatingForm id={question.id} current={question.rating} />
          </CardBody>
        </Card>
      ) : null}

      {inWindow && !question.followUpText ? (
        <Card>
          <CardHeader title="Anlamadığınız bir yer mi var?" description="Öğretmene bir kez ek soru sorabilirsiniz." />
          <CardBody>
            <FollowUpForm id={question.id} />
          </CardBody>
        </Card>
      ) : null}

      {inWindow ? (
        <Card>
          <CardHeader title="Çözümde bir sorun mu var?" description={`${formatDateTime(question.disputeUntil!)} saatine kadar bildirebilirsiniz.`} />
          <CardBody>
            <DisputeForm id={question.id} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

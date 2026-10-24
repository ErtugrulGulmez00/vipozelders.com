import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnswerForm, ClaimForm, FollowUpAnswerForm, RejectForm, ReleaseClaimForm } from "@/components/panel/pool-forms";
import { PoolQuestionView } from "@/components/panel/pool-question-view";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { PoolError, teacherQuestion } from "@/server/question-pool";

export const metadata: Metadata = { title: "Havuz sorusu" };

export default async function TeacherPoolQuestionPage({ params }: PageProps<"/ogretmen-paneli/soru-havuzu/[id]">) {
  const user = await requireRole("TEACHER");
  const { id } = await params;
  const question = await teacherQuestion(user.id, id).catch((error: unknown) => {
    if (error instanceof PoolError) return null;
    throw error;
  });
  if (!question) notFound();
  const mine = question.claimedById === user.id;
  const now = new Date();

  return (
    <div className="space-y-5">
      <Link href="/ogretmen-paneli/soru-havuzu" className="text-sm text-brand-700 hover:underline">
        ← Soru havuzu
      </Link>

      {question.status === "OPEN" ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Bu soruyu üstlenirseniz başka öğretmen göremez. Çözüm için {formatMoney(question.teacherFee)} hakediş oluşur.
            </p>
            <ClaimForm id={question.id} />
          </CardBody>
        </Card>
      ) : null}

      {mine && question.status === "CLAIMED" && question.claimExpiresAt ? (
        <Alert tone={question.claimExpiresAt.getTime() - now.getTime() < (question.subscriptionId ? 60 : 10) * 60_000 ? "warning" : "info"}>
          {question.subscriptionId
            ? `Abonenizin sorusu: ${formatDateTime(question.claimExpiresAt)} saatine kadar çözümü gönderin; gönderilmezse cevaplanmamış soru sayılır.`
            : `Soru sizde: ${formatDateTime(question.claimExpiresAt)} saatine kadar çözümü gönderin; gönderilmezse havuza geri döner.`}
        </Alert>
      ) : null}

      {mine && question.status === "ANSWERED" ? (
        <Alert tone="success">Çözümünüz öğrenciye gönderildi. Öğrenci bir kez ek soru sorabilir; gelirse bildirim alırsınız.</Alert>
      ) : null}

      <PoolQuestionView question={question} viewer="teacher" />

      {mine && question.status === "CLAIMED" ? (
        <Card>
          <CardHeader title="Çözümü gönderin" action={question.subscriptionId ? undefined : <ReleaseClaimForm id={question.id} />} />
          <CardBody className="space-y-5">
            <AnswerForm id={question.id} />
            <div className="border-t border-slate-100 pt-4">
              <RejectForm id={question.id} />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {mine && question.followUpText && !question.followUpAnswer ? (
        <Card>
          <CardHeader title="Öğrencinin ek sorusu" />
          <CardBody>
            <FollowUpAnswerForm id={question.id} />
          </CardBody>
        </Card>
      ) : null}

      {mine && question.releaseAt && question.teacherFee > 0 && ["ANSWERED", "DISPUTED"].includes(question.status) ? (
        <p className="text-sm text-slate-500">
          {formatMoney(question.teacherFee)} hakedişiniz {formatDateTime(question.releaseAt)} sonrasında ödenebilir bakiyenize geçer (itiraz süresi ve ödeme kuruluşu aktarım süresi).
        </p>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionView } from "@/components/center/question-view";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { AnswerForm } from "../answer-form";

export const metadata: Metadata = { title: "Soru" };

export default async function QuestionPage({ params }: PageProps<"/kurum/sorular/[id]">) {
  const ctx = await requireCenter("questions.answer");
  const { id } = await params;
  const q = await db.centerQuestion.findFirst({
    where: { id, centerId: ctx.center.id },
    include: { student: { select: { id: true, firstName: true, lastName: true, gradeName: true } }, answeredBy: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  if (!q) notFound();
  const [others] = await Promise.all([db.centerQuestion.count({ where: { studentId: q.studentId, id: { not: q.id } } })]);
  return (
    <>
      <PageHeader
        title={`${q.student.firstName} ${q.student.lastName} · ${q.subject}`}
        description={[q.student.gradeName, others ? `${others} soru daha sordu` : null].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/kurum/ogrenciler/${q.student.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
              Öğrenci kartı
            </Link>
            <Link href="/kurum/sorular" className="text-sm font-semibold text-brand-700 hover:underline">
              ← Sorular
            </Link>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <Card>
          <CardBody>
            <QuestionView
              q={{ ...q, answeredBy: q.answeredBy ? `${q.answeredBy.user.firstName} ${q.answeredBy.user.lastName}` : null }}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={q.status === "OPEN" ? "Cevapla" : "Cevabı güncelle"} description="Öğrenciye ve velisine bildirim gider." />
          <CardBody>
            <AnswerForm questionId={q.id} answered={q.status !== "OPEN"} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

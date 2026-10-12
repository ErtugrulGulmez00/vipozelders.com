import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { dbDateToString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { getExamOrThrow } from "@/server/center/exams";
import { CenterError } from "@/server/center/errors";
import { DeleteExamForm, ExamMetaForm } from "../../exam-forms";
import { ExamHeader } from "../exam-header";

export const metadata: Metadata = { title: "Deneme ayarları" };

export default async function ExamSettingsPage({ params }: PageProps<"/kurum/denemeler/[id]/ayarlar">) {
  const ctx = await requireCenter("exams.manage");
  const { id } = await params;
  const exam = await getExamOrThrow(ctx, id).catch((error) => {
    if (error instanceof CenterError) notFound();
    throw error;
  });
  return (
    <>
      <ExamHeader exam={exam} active="ayarlar" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader title="Deneme bilgileri" description="Yanlış götürme kuralı değişirse tüm netler yeniden hesaplanır." />
          <CardBody>
            <ExamMetaForm exam={{ id: exam.id, name: exam.name, date: dbDateToString(exam.date), publisher: exam.publisher, wrongPenalty: exam.wrongPenalty }} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Bölümler" />
          <CardBody>
            <ul className="space-y-1 text-sm text-slate-700">
              {exam.sections.map((s) => (
                <li key={s.id}>
                  {s.name} · {s.questionCount} soru {s.answerKey ? "· anahtar var" : ""}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-slate-100 pt-4">
              <DeleteExamForm examId={exam.id} />
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/primitives";
import { topicsToText } from "@/lib/center/exams";
import { requireCenter } from "@/server/center/context";
import { getExamOrThrow } from "@/server/center/exams";
import { CenterError } from "@/server/center/errors";
import { AnswerKeyForm } from "../../exam-forms";
import { ExamHeader } from "../exam-header";

export const metadata: Metadata = { title: "Cevap anahtarı" };

export default async function AnswerKeyPage({ params }: PageProps<"/kurum/denemeler/[id]/anahtar">) {
  const ctx = await requireCenter("exams.manage");
  const { id } = await params;
  const exam = await getExamOrThrow(ctx, id).catch((error) => {
    if (error instanceof CenterError) notFound();
    throw error;
  });
  return (
    <>
      <ExamHeader exam={exam} active="anahtar" />
      <Alert tone="info" className="mb-6" title="Cevap anahtarı ne işe yarar?">
        Anahtar ve konu dağılımı girilirse öğrencilerin cevaplarından doğru/yanlış otomatik çıkar; her öğrencinin eksik konuları, sınıfın en çok zorlandığı konular ve soru bazında
        analiz hazırlanır. Yalnızca doğru/yanlış sayılarıyla çalışacaksanız bu adımı atlayabilirsiniz.
      </Alert>
      <AnswerKeyForm
        examId={exam.id}
        sections={exam.sections.map((s) => ({ id: s.id, name: s.name, questionCount: s.questionCount, answerKey: s.answerKey, topicsText: topicsToText(s.topics) }))}
      />
    </>
  );
}

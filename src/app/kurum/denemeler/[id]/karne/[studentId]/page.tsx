import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/center/center-client";
import { ReportCard } from "@/components/center/report-card";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { studentExamReport } from "@/server/center/exams";
import { db } from "@/server/db";
import { StudentAnswersForm } from "../../../exam-forms";

export const metadata: Metadata = { title: "Deneme karnesi" };

export default async function ReportCardPage({ params }: PageProps<"/kurum/denemeler/[id]/karne/[studentId]">) {
  const ctx = await requireCenter("exams.manage");
  const { id, studentId } = await params;
  const student = await db.centerStudent.findFirst({
    where: { id: studentId, centerId: ctx.center.id },
    select: { id: true, firstName: true, lastName: true, studentNumber: true, gradeName: true, groups: { select: { group: { select: { name: true } } } } },
  });
  if (!student) notFound();
  const report = await studentExamReport(ctx.center.id, id, studentId);
  if (!report) notFound();
  const own = report.result?.sections ?? [];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/kurum/denemeler/${id}`} className="text-sm font-semibold text-brand-700 hover:underline">
          ← {report.analysis.exam.name}
        </Link>
        <PrintButton label="Karneyi yazdır / PDF" />
      </div>
      <ReportCard
        report={report}
        centerName={ctx.center.name}
        showSuggestions={ctx.center.showTeacherSuggestions}
        studentName={`${student.firstName} ${student.lastName}`}
        studentMeta={[student.studentNumber ? `No ${student.studentNumber}` : null, student.gradeName, student.groups.map((g) => g.group.name).join(", ")].filter(Boolean).join(" · ")}
      />
      <Card className="mt-6 print:hidden">
        <CardHeader title="Öğrencinin cevapları" description="Cevapları girerseniz doğru/yanlış anahtardan hesaplanır ve konu analizi çıkar." />
        <CardBody>
          <StudentAnswersForm
            examId={id}
            studentId={student.id}
            score={report.result?.score ?? null}
            sections={report.analysis.exam.sections.map((s) => ({
              id: s.id,
              name: s.name,
              questionCount: s.questionCount,
              hasKey: Boolean(s.answerKey),
              answers: own.find((o) => o.sectionId === s.id)?.answers ?? null,
            }))}
          />
        </CardBody>
      </Card>
    </>
  );
}

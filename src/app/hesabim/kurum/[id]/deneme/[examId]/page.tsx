import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/center/center-client";
import { ReportCard } from "@/components/center/report-card";
import { requireRole } from "@/server/auth/current-user";
import { studentExamReport } from "@/server/center/exams";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Deneme karnesi" };

export default async function GuardianReportCardPage({ params }: PageProps<"/hesabim/kurum/[id]/deneme/[examId]">) {
  const user = await requireRole("STUDENT");
  const { id, examId } = await params;
  const link = await db.centerGuardian.findFirst({
    where: { id, userId: user.id, student: { center: { status: { not: "SUSPENDED" } } } },
    include: { student: { select: { id: true, centerId: true, firstName: true, lastName: true, studentNumber: true, gradeName: true, center: { select: { name: true, showTeacherSuggestions: true } } } } },
  });
  if (!link) notFound();
  const exam = await db.centerExam.findFirst({ where: { id: examId, centerId: link.student.centerId, isPublished: true }, select: { id: true } });
  if (!exam) notFound();
  const report = await studentExamReport(link.student.centerId, examId, link.student.id, { publishedOnly: true });
  if (!report?.result) notFound();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/hesabim/kurum/${id}?sekme=denemeler`} className="text-sm font-semibold text-brand-700 hover:underline">
          ← Denemeler
        </Link>
        <PrintButton label="Yazdır / PDF" />
      </div>
      <ReportCard
        report={report}
        centerName={link.student.center.name}
        showSuggestions={link.student.center.showTeacherSuggestions}
        studentName={`${link.student.firstName} ${link.student.lastName}`}
        studentMeta={[link.student.studentNumber ? `No ${link.student.studentNumber}` : null, link.student.gradeName].filter(Boolean).join(" · ")}
      />
    </>
  );
}

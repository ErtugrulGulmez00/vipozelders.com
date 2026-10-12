import type { Metadata } from "next";
import Form from "next/form";
import { notFound } from "next/navigation";
import { CenterFlash } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { getExamOrThrow } from "@/server/center/exams";
import { CenterError } from "@/server/center/errors";
import { db } from "@/server/db";
import { ResultsGrid } from "../../exam-forms";
import { ExamHeader } from "../exam-header";

export const metadata: Metadata = { title: "Sonuç girişi" };

export default async function ExamResultsEntryPage({ params, searchParams }: PageProps<"/kurum/denemeler/[id]/sonuclar">) {
  const ctx = await requireCenter("exams.manage");
  const { id } = await params;
  const sp = await searchParams;
  const exam = await getExamOrThrow(ctx, id).catch((error) => {
    if (error instanceof CenterError) notFound();
    throw error;
  });
  const groupId = String(sp.grup ?? "");
  const [groups, results] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerExamResult.findMany({ where: { examId: exam.id }, include: { sections: true } }),
  ]);
  const students = await db.centerStudent.findMany({
    where: {
      centerId: ctx.center.id,
      OR: [{ status: "ACTIVE", ...(groupId ? { groups: { some: { groupId } } } : {}) }, ...(groupId ? [] : [{ id: { in: results.map((r) => r.studentId) } }])],
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, studentNumber: true },
  });
  const byStudent = new Map(results.map((r) => [r.studentId, r]));
  return (
    <>
      <ExamHeader exam={exam} active="sonuclar" />
      <CenterFlash code={sp.durum} />
      <Form action={`/kurum/denemeler/${exam.id}/sonuclar`} className="mb-4 flex flex-wrap gap-2">
        <Select name="grup" defaultValue={groupId} className="h-9 w-52" aria-label="Sınıf">
          <option value="">Tüm aktif öğrenciler</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClasses("secondary", "sm", "h-9")}>
          Listele
        </button>
      </Form>
      {students.length === 0 ? (
        <EmptyState title="Listede öğrenci yok" />
      ) : (
        <ResultsGrid
          examId={exam.id}
          penalty={exam.wrongPenalty}
          sections={exam.sections.map((s) => ({ id: s.id, name: s.name, questionCount: s.questionCount }))}
          students={students.map((s) => {
            const result = byStudent.get(s.id);
            return {
              id: s.id,
              name: `${s.firstName} ${s.lastName}`,
              studentNumber: s.studentNumber,
              score: result?.score ?? null,
              hasResult: Boolean(result),
              values: Object.fromEntries((result?.sections ?? []).map((sr) => [sr.sectionId, { d: sr.correct, y: sr.wrong }])),
            };
          })}
        />
      )}
    </>
  );
}

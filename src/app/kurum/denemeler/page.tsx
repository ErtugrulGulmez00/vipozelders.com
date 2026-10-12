import { BookOpenCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash, shortDate } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { EXAM_PRESETS, formatNet, round2, type ExamKindName } from "@/lib/center/exams";
import { toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { getCatalog } from "@/server/site";
import { CreateExamForm } from "./exam-forms";

export const metadata: Metadata = { title: "Denemeler" };

export default async function ExamsPage({ searchParams }: PageProps<"/kurum/denemeler">) {
  const ctx = await requireCenter("exams.manage");
  const sp = await searchParams;
  const kind = String(sp.tur ?? "");
  const [exams, catalog] = await Promise.all([
    db.centerExam.findMany({
      where: { centerId: ctx.center.id, ...(kind && kind in EXAM_PRESETS ? { kind: kind as ExamKindName } : {}) },
      orderBy: { date: "desc" },
      take: 100,
      include: { sections: { select: { questionCount: true, answerKey: true } }, results: { select: { net: true } } },
    }),
    getCatalog(),
  ]);
  const kinds = [...new Set((await db.centerExam.findMany({ where: { centerId: ctx.center.id }, select: { kind: true }, distinct: ["kind"] })).map((e) => e.kind))];
  return (
    <>
      <PageHeader title="Denemeler" description="LGS, TYT, AYT ve kurum içi sınavlar: net, sıralama, ders ve konu analizi" />
      <CenterFlash code={sp.durum} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-3">
          {kinds.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              <Link href="/kurum/denemeler" className={`rounded-full px-3 py-1 text-xs font-semibold ${!kind ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                Tümü
              </Link>
              {kinds.map((k) => (
                <Link key={k} href={`/kurum/denemeler?tur=${k}`} className={`rounded-full px-3 py-1 text-xs font-semibold ${kind === k ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {EXAM_PRESETS[k].label}
                </Link>
              ))}
            </div>
          ) : null}
          {exams.length === 0 ? (
            <EmptyState icon={<BookOpenCheck className="size-8" />} title="Henüz deneme yok" description="Sağdaki formdan ilk denemenizi oluşturun." />
          ) : (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Deneme</Th>
                    <Th>Tarih</Th>
                    <Th className="text-right">Katılım</Th>
                    <Th className="text-right">Ort. net</Th>
                    <Th>Durum</Th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => {
                    const questions = exam.sections.reduce((t, s) => t + s.questionCount, 0);
                    const avg = exam.results.length ? round2(exam.results.reduce((t, r) => t + r.net, 0) / exam.results.length) : null;
                    return (
                      <tr key={exam.id} className="hover:bg-slate-50/60">
                        <Td>
                          <Link href={`/kurum/denemeler/${exam.id}`} className="font-semibold text-brand-700 hover:underline">
                            {exam.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {EXAM_PRESETS[exam.kind].label}
                            {exam.publisher ? ` · ${exam.publisher}` : ""} · {questions} soru
                            {exam.sections.every((s) => s.answerKey) ? " · anahtar girildi" : ""}
                          </p>
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{shortDate(exam.date)}</Td>
                        <Td className="text-right">{exam.results.length}</Td>
                        <Td className="text-right font-semibold">{avg !== null ? formatNet(avg) : "—"}</Td>
                        <Td>{exam.isPublished ? <Badge tone="green">Velilere açık</Badge> : <Badge tone="slate">Taslak</Badge>}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
        <Card>
          <CardHeader title="Yeni deneme" description="Şablon seçince bölümler ve soru sayıları otomatik gelir." />
          <CardBody>
            <CreateExamForm subjects={catalog.subjects.map((s) => ({ slug: s.slug, name: s.name }))} today={toLocalDateString(new Date())} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

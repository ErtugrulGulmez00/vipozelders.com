import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { EXAM_PRESETS, penaltyLabel } from "@/lib/center/exams";
import { toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { getPdfImport } from "@/server/center/exam-pdf-import";
import { DiscardPdfForm, PdfMatchForm, type MatchExam } from "../pdf-forms";

export const metadata: Metadata = { title: "PDF eşleştirme" };

const STATUS_NOTE: Record<string, string> = { PASSIVE: " (pasif)", LEFT: " (ayrıldı)" };

export default async function ExamPdfMatchPage({ params }: PageProps<"/kurum/denemeler/pdf-aktar/[importId]">) {
  const ctx = await requireCenter("exams.manage");
  // Aynı sayfa Pi Koç panelinde de açılır (/koc/denemeler/pdf-aktar/...)
  const coach = ctx.center.kind === "COACH";
  const { importId } = await params;
  const data = await getPdfImport(ctx, importId).catch((error) => {
    if (error instanceof CenterError) notFound();
    throw error;
  });
  const exams: MatchExam[] = data.exams.map(({ exam, matches, existing }) => {
    const keyed = exam.sections.filter((s) => s.answerKey).length;
    const withTopics = exam.sections.filter((s) => s.topics.some(Boolean)).length;
    return {
      name: exam.name,
      kindLabel: EXAM_PRESETS[exam.kind].label,
      summary: [
        exam.sections.map((s) => `${s.name} ${s.questionCount}`).join(", "),
        `yanlış götürme: ${penaltyLabel(exam.wrongPenalty).toLocaleLowerCase("tr-TR")}`,
        keyed ? `${keyed}/${exam.sections.length} derste cevap anahtarı` : "cevap anahtarı yok",
        withTopics ? `${withTopics} derste kazanım` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      existing: existing?.name ?? null,
      ai: exam.source === "ai",
      notes: exam.notes ?? [],
      rows: exam.students.map((st, i) => ({
        name: st.name,
        number: st.number,
        className: st.className,
        net: Math.round(st.sections.reduce((t, s) => t + (s?.net ?? 0), 0) * 100) / 100,
        score: st.score,
        studentId: matches[i].studentId,
        confidence: matches[i].confidence,
        suggestions: matches[i].suggestions.map((s) => s.id),
        warnings: st.warnings ?? [],
      })),
    };
  });
  const total = exams.reduce((t, e) => t + e.rows.length, 0);
  const unmatched = exams.reduce((t, e) => t + e.rows.filter((r) => !r.studentId).length, 0);
  const flagged = exams.reduce((t, e) => t + e.rows.filter((r) => r.warnings.length).length, 0);
  const candidates = data.candidates.map((c) => ({
    id: c.id,
    label: `${c.firstName} ${c.lastName}${c.studentNumber ? ` · ${c.studentNumber}` : ""}${c.groups.length ? ` · ${c.groups.join(", ")}` : ""}${STATUS_NOTE[c.status] ?? ""}`,
  }));
  return (
    <>
      <Link href={coach ? "/koc/denemeler" : "/kurum/denemeler/pdf-aktar"} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Başka PDF yükle
      </Link>
      <PageHeader
        title="Öğrencileri eşleştirin"
        description={`${data.draft.fileName} · ${exams.length} deneme, ${total} öğrenci`}
        actions={<DiscardPdfForm draftId={data.draft.id} />}
      />
      <Alert tone={unmatched || flagged ? "warning" : "success"} className="mb-6">
        {unmatched
          ? `${total - unmatched} öğrenci otomatik eşleşti. ${unmatched} öğrenci için ${coach ? "öğrencinizi" : "kurumdaki öğrenciyi"} seçin; ${coach ? "öğrencileriniz arasında" : "kurumunuzda"} olmayanları “Aktarma” olarak bırakın.`
          : `Tüm öğrenciler eşleşti. Sarı işaretli satırlara bir göz atıp aktarın.`}
        {flagged ? ` ${flagged} satırda değerler tutarsız (kırmızı); PDF'ten kontrol edin.` : null}
      </Alert>
      {candidates.length === 0 ? (
        <Alert tone="warning" className="mb-6">
          {coach ? "Henüz öğrenciniz yok. Önce öğrencilerinizi ekleyin, sonra bu sayfaya dönün." : "Kurumda kayıtlı öğrenci yok. Önce öğrencilerinizi ekleyin (Excel ile toplu ekleyebilirsiniz), sonra bu sayfaya dönün."}
        </Alert>
      ) : null}
      <PdfMatchForm draftId={data.draft.id} exams={exams} candidates={candidates} today={toLocalDateString(new Date())} coach={coach} />
      <p className="mt-6 text-xs text-slate-500">
        Puan ve ilçe/il/genel sıralamaları yayınevinin hesapladığı değerlerdir ve karnede ayrıca gösterilir; kurum sırası aktarılan öğrencilerden yeniden hesaplanır.
      </p>
    </>
  );
}

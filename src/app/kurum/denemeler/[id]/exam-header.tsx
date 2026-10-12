import { shortDate, Tabs } from "@/components/center/center-ui";
import { Badge, PageHeader } from "@/components/ui/primitives";
import { EXAM_PRESETS, penaltyLabel, type ExamKindName } from "@/lib/center/exams";

/** Deneme sayfalarının ortak başlığı ve sekmeleri. */
export function ExamHeader({ exam, active }: { exam: { id: string; name: string; kind: ExamKindName; date: Date; publisher: string | null; wrongPenalty: number; isPublished: boolean }; active: string }) {
  const base = `/kurum/denemeler/${exam.id}`;
  return (
    <>
      <PageHeader
        title={exam.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {EXAM_PRESETS[exam.kind].label} · {shortDate(exam.date)}
            {exam.publisher ? ` · ${exam.publisher}` : ""} · {penaltyLabel(exam.wrongPenalty)}
            {exam.isPublished ? <Badge tone="green">Velilere açık</Badge> : <Badge tone="slate">Taslak</Badge>}
          </span>
        }
      />
      <Tabs
        active={active}
        tabs={[
          { key: "analiz", label: "Sonuçlar ve analiz", href: base },
          { key: "sonuclar", label: "Sonuç girişi", href: `${base}/sonuclar` },
          { key: "anahtar", label: "Cevap anahtarı ve konular", href: `${base}/anahtar` },
          { key: "aktar", label: "Excel'den aktar", href: `${base}/ice-aktar` },
          { key: "ayarlar", label: "Ayarlar", href: `${base}/ayarlar` },
        ]}
      />
    </>
  );
}

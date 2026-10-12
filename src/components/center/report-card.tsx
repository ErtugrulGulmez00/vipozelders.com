import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { NetTrendChart, percent, RateBar, rateTone, shortDate } from "@/components/center/center-ui";
import { Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui/primitives";
import { EXAM_PRESETS, formatNet, successRate } from "@/lib/center/exams";
import { marketplaceLink, type studentExamReport } from "@/server/center/exams";

type Report = NonNullable<Awaited<ReturnType<typeof studentExamReport>>>;

/** Öğrenci deneme karnesi: kurum panelinde ve veli portalında aynı görünüm (yazdırılabilir). */
export function ReportCard({
  report,
  centerName,
  studentName,
  studentMeta,
  showSuggestions = true,
}: {
  report: Report;
  centerName: string;
  studentName: string;
  studentMeta: string;
  /** Kurum kapattıysa Pi Kampüs özel ders öğretmeni önerisi gösterilmez */
  showSuggestions?: boolean;
}) {
  const { analysis, result, sections, weakTopics, trend } = report;
  const { exam } = analysis;
  if (!result) return <p className="text-sm text-slate-500">Bu öğrencinin bu denemede sonucu yok.</p>;
  const totalQuestions = exam.sections.reduce((t, s) => t + s.questionCount, 0);
  const weakSections = !showSuggestions ? [] : sections.filter((s) => s.own && s.own.net < s.average.net && successRate(s.own.net, s.section.questionCount) < 0.6);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{centerName} · Deneme karnesi</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{studentName}</h2>
            <p className="text-sm text-slate-500">{studentMeta}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-slate-900">{exam.name}</p>
            <p className="text-sm text-slate-500">
              {EXAM_PRESETS[exam.kind].label} · {shortDate(exam.date)}
              {exam.publisher ? ` · ${exam.publisher}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-brand-50 p-3">
            <p className="text-xs font-semibold text-brand-700">Toplam net</p>
            <p className="text-2xl font-bold text-brand-900">{formatNet(result.net)}</p>
            <p className="text-xs text-brand-700">{totalQuestions} soru</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Kurum sırası</p>
            <p className="text-2xl font-bold text-slate-900">{result.rank ?? "—"}</p>
            <p className="text-xs text-slate-500">{analysis.participants} öğrenci arasında</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">Kurum ortalaması</p>
            <p className="text-2xl font-bold text-slate-900">{formatNet(analysis.average)}</p>
            <p className="text-xs text-slate-500">en yüksek {formatNet(analysis.max)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">D / Y / B</p>
            <p className="text-2xl font-bold text-slate-900">
              {result.correct}/{result.wrong}/{result.blank}
            </p>
            <p className="text-xs text-slate-500">{result.score ? `Puan ${result.score.toLocaleString("tr-TR")}` : "Puan girilmedi"}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader title="Ders bazında sonuç" />
        <Table>
          <thead>
            <tr>
              <Th>Ders</Th>
              <Th className="text-right">D</Th>
              <Th className="text-right">Y</Th>
              <Th className="text-right">B</Th>
              <Th className="text-right">Net</Th>
              <Th className="text-right">Kurum ort.</Th>
              <Th className="w-40">Başarı</Th>
            </tr>
          </thead>
          <tbody>
            {sections.map(({ section, own, average }) => {
              const rate = own ? successRate(own.net, section.questionCount) : 0;
              return (
                <tr key={section.id}>
                  <Td>
                    <p className="font-semibold text-slate-900">{section.name}</p>
                    <p className="text-xs text-slate-500">{section.questionCount} soru</p>
                  </Td>
                  <Td className="text-right">{own?.correct ?? "—"}</Td>
                  <Td className="text-right">{own?.wrong ?? "—"}</Td>
                  <Td className="text-right">{own?.blank ?? "—"}</Td>
                  <Td className={`text-right font-bold ${own && own.net < average.net ? "text-rose-600" : "text-slate-900"}`}>{own ? formatNet(own.net) : "—"}</Td>
                  <Td className="text-right text-slate-500">{formatNet(average.net)}</Td>
                  <Td>
                    {own ? (
                      <div className="flex items-center gap-2">
                        <RateBar value={rate} tone={rateTone(rate)} />
                        <span className="w-9 text-right text-xs font-semibold">{percent(rate)}</span>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {weakTopics.length || weakSections.length ? (
        <Card>
          <CardHeader title="Eksikler ve öneriler" description="Konu bazında en fazla yarısını doğru yapabildiği konular ve ortalamanın altında kaldığı dersler" />
          <CardBody className="space-y-4">
            {weakTopics.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {weakTopics.map((t) => (
                  <li key={`${t.sectionName}-${t.topic}`} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{t.topic}</p>
                      <span className="text-xs font-bold text-rose-600">{percent(t.rate)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {t.sectionName} · {t.questions} soruda {t.correct} doğru, {t.wrong} yanlış, {t.blank} boş
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            {weakSections.length ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 print:hidden">
                <p className="font-semibold">Destek önerisi</p>
                <ul className="mt-1 space-y-1">
                  {weakSections.map(({ section }) => (
                    <li key={section.id}>
                      {section.name}:{" "}
                      <Link href={marketplaceLink(exam.kind, section.subjectSlug)} target="_blank" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
                        birebir özel ders veren öğretmenlere göz at <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {sections.some((s) => s.topics.length) ? (
        <Card>
          <CardHeader title="Konu analizi" />
          <CardBody className="grid gap-6 md:grid-cols-2">
            {sections
              .filter((s) => s.topics.length)
              .map((s) => (
                <div key={s.section.id}>
                  <p className="mb-2 text-sm font-bold text-slate-800">{s.section.name}</p>
                  <ul className="space-y-1.5">
                    {s.topics.map((t) => (
                      <li key={t.topic} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-slate-700">{t.topic}</span>
                        <span className="text-xs text-slate-500">
                          {t.correct}/{t.questions}
                        </span>
                        <RateBar value={t.rate} tone={rateTone(t.rate)} className="w-20" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </CardBody>
        </Card>
      ) : null}

      {trend.length >= 2 ? (
        <Card>
          <CardHeader title={`${EXAM_PRESETS[exam.kind].label} net gelişimi`} />
          <CardBody>
            <NetTrendChart points={trend} maxNet={totalQuestions} />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

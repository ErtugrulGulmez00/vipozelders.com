import { Download } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash, percent, RateBar, rateTone } from "@/components/center/center-ui";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Card, CardBody, CardHeader, EmptyState, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatNet, successRate } from "@/lib/center/exams";
import { requireCenter } from "@/server/center/context";
import { examAnalysis } from "@/server/center/exams";
import { db } from "@/server/db";
import { PublishExamForm } from "../exam-forms";
import { ExamHeader } from "./exam-header";

export const metadata: Metadata = { title: "Deneme analizi" };

export default async function ExamAnalysisPage({ params, searchParams }: PageProps<"/kurum/denemeler/[id]">) {
  const ctx = await requireCenter("exams.manage");
  const { id } = await params;
  const sp = await searchParams;
  const groupId = String(sp.grup ?? "") || null;
  const [analysis, groups] = await Promise.all([
    examAnalysis(ctx.center.id, id, groupId),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!analysis) notFound();
  const { exam, results, sectionAverages, topics, questions } = analysis;
  const totalQuestions = exam.sections.reduce((t, s) => t + s.questionCount, 0);
  const buckets = Array.from({ length: 5 }, (_, i) => ({ from: (totalQuestions / 5) * i, to: (totalQuestions / 5) * (i + 1), count: 0 }));
  for (const r of results) {
    const index = Math.min(4, Math.max(0, Math.floor((Math.max(0, r.net) / Math.max(totalQuestions, 1)) * 5)));
    buckets[index].count++;
  }
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <>
      <ExamHeader exam={exam} active="analiz" />
      <CenterFlash code={sp.durum} />
      {results.length === 0 && !groupId ? (
        <EmptyState
          title="Henüz sonuç girilmedi"
          description="Sonuçları tablodan elle girebilir ya da yayınevinin Excel dosyasını aktarabilirsiniz."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href={`/kurum/denemeler/${exam.id}/sonuclar`}>Sonuç gir</LinkButton>
              <LinkButton href={`/kurum/denemeler/${exam.id}/ice-aktar`} variant="outline">
                Excel’den aktar
              </LinkButton>
            </div>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Form action={`/kurum/denemeler/${exam.id}`} className="flex gap-2">
              <Select name="grup" defaultValue={groupId ?? ""} className="h-9 w-48" aria-label="Sınıf">
                <option value="">Tüm kurum</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonClasses("secondary", "sm", "h-9")}>
                Süz
              </button>
            </Form>
            <a href={`/api/kurum/disa-aktar/deneme-sonuclari?deneme=${exam.id}`} download className={buttonClasses("outline", "sm")}>
              <Download className="size-4" aria-hidden /> Sonuç listesi (CSV)
            </a>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Katılım" value={analysis.participants} />
            <StatCard label="Ortalama net" value={formatNet(analysis.average)} hint={`${totalQuestions} soru üzerinden`} />
            <StatCard label="En yüksek" value={formatNet(analysis.max)} />
            <StatCard label="En düşük" value={formatNet(analysis.min)} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
            <Card>
              <CardHeader title="Ders ortalamaları" />
              <Table>
                <thead>
                  <tr>
                    <Th>Ders</Th>
                    <Th className="text-right">D</Th>
                    <Th className="text-right">Y</Th>
                    <Th className="text-right">B</Th>
                    <Th className="text-right">Net</Th>
                    <Th className="w-36">Başarı</Th>
                  </tr>
                </thead>
                <tbody>
                  {sectionAverages.map((s) => {
                    const rate = successRate(s.net, s.questionCount);
                    return (
                      <tr key={s.sectionId}>
                        <Td>
                          <p className="font-semibold text-slate-900">{s.name}</p>
                          <p className="text-xs text-slate-500">{s.questionCount} soru · en yüksek {formatNet(s.maxNet)}</p>
                        </Td>
                        <Td className="text-right">{formatNet(s.correct)}</Td>
                        <Td className="text-right">{formatNet(s.wrong)}</Td>
                        <Td className="text-right">{formatNet(s.blank)}</Td>
                        <Td className="text-right font-bold">{formatNet(s.net)}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <RateBar value={rate} tone={rateTone(rate)} />
                            <span className="w-9 text-right text-xs font-semibold">{percent(rate)}</span>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader title="Net dağılımı" />
                <CardBody className="space-y-2">
                  {buckets.map((b) => (
                    <div key={b.from} className="flex items-center gap-3 text-sm">
                      <span className="w-20 shrink-0 text-xs text-slate-500">
                        {Math.round(b.from)}–{Math.round(b.to)} net
                      </span>
                      <div className="h-5 flex-1 rounded bg-slate-100">
                        <div className="h-5 rounded bg-brand-500" style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-semibold">{b.count}</span>
                    </div>
                  ))}
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Veli portalı" />
                <CardBody>
                  <PublishExamForm examId={exam.id} isPublished={exam.isPublished} />
                </CardBody>
              </Card>
            </div>
          </div>

          {topics.length ? (
            <Card className="mt-6">
              <CardHeader title="Konu analizi" description="Cevapları okunan öğrencilerde konu başına doğru oranı; en zorlanılan konu başta" />
              <CardBody className="grid gap-6 md:grid-cols-2">
                {topics.map((section) => (
                  <div key={section.sectionId}>
                    <p className="mb-2 text-sm font-bold text-slate-800">{section.sectionName}</p>
                    <ul className="space-y-2">
                      {section.stats.map((t) => (
                        <li key={t.topic}>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-slate-700">{t.topic}</span>
                            <span className="shrink-0 text-xs font-semibold text-slate-600">
                              {percent(t.rate)} · {t.questions} soru
                            </span>
                          </div>
                          <RateBar value={t.rate} tone={rateTone(t.rate)} className="mt-1" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {questions.length ? (
            <Card className="mt-6">
              <CardHeader title="Soru analizi" description="Her sorunun doğru cevaplanma oranı; kırmızı sorular sınıfça tekrar edilmeli" />
              <CardBody className="space-y-5">
                {questions.map((q) => (
                  <div key={q.sectionId}>
                    <p className="mb-2 text-sm font-bold text-slate-800">{q.sectionName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {q.rates.map((r, i) => {
                        const tone = r.correct >= 0.7 ? "bg-emerald-100 text-emerald-800" : r.correct >= 0.4 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";
                        const popularWrong = Object.entries(r.choices)
                          .filter(([c]) => c !== q.key[i] && c !== "-")
                          .sort((a, b) => b[1] - a[1])[0];
                        return (
                          <span key={i} className={`inline-flex w-14 flex-col items-center rounded-lg px-1 py-1 text-[11px] ${tone}`} title={`Cevap ${q.key[i]}${popularWrong ? ` · en çok işaretlenen yanlış ${popularWrong[0]} (${popularWrong[1]})` : ""}`}>
                            <span className="font-bold">
                              {i + 1}. {q.key[i]}
                            </span>
                            <span>{percent(r.correct)}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          <Card className="mt-6">
            <CardHeader title="Sıralama" description={groupId ? "Seçili sınıf içindeki sıralama, kurum sırası parantez içinde" : undefined} />
            <Table>
              <thead>
                <tr>
                  <Th>Sıra</Th>
                  <Th>Öğrenci</Th>
                  {exam.sections.map((s) => (
                    <Th key={s.id} className="text-right">
                      {s.name.length > 12 ? `${s.name.slice(0, 11)}…` : s.name}
                    </Th>
                  ))}
                  <Th className="text-right">Net</Th>
                  <Th className="text-right">Puan</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {results.map((r, index) => (
                  <tr key={r.id}>
                    <Td className="font-semibold">
                      {groupId ? index + 1 : r.rank}
                      {groupId && r.rank ? <span className="ml-1 text-xs font-normal text-slate-400">({r.rank})</span> : null}
                    </Td>
                    <Td>
                      <Link href={`/kurum/ogrenciler/${r.student.id}?sekme=denemeler`} className="font-semibold text-brand-700 hover:underline">
                        {r.student.firstName} {r.student.lastName}
                      </Link>
                      <p className="text-xs text-slate-500">{r.student.groups.map((g) => g.group.name).join(", ")}</p>
                    </Td>
                    {exam.sections.map((s) => {
                      const sr = r.sections.find((x) => x.sectionId === s.id);
                      return (
                        <Td key={s.id} className="text-right text-xs">
                          {sr ? formatNet(sr.net) : "—"}
                        </Td>
                      );
                    })}
                    <Td className="text-right font-bold">{formatNet(r.net)}</Td>
                    <Td className="text-right text-xs">{r.score ?? "—"}</Td>
                    <Td>
                      <Link href={`/kurum/denemeler/${exam.id}/karne/${r.student.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                        Karne
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}

import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { addDaysToDateString, isoWeekday, WEEKDAY_SHORT } from "@/lib/dates";
import type { TopicCell } from "@/server/koc-plan";
import { topicMap } from "@/server/koc-plan";
import { AddTopicToPlanForm } from "./koc-forms";

const LEVEL = {
  weak: { cls: "bg-rose-100 text-rose-900 ring-rose-200", label: "Zayıf (<%50)" },
  mid: { cls: "bg-amber-100 text-amber-900 ring-amber-200", label: "Orta (%50-75)" },
  good: { cls: "bg-emerald-100 text-emerald-900 ring-emerald-200", label: "İyi (≥%75)" },
  none: { cls: "bg-slate-50 text-slate-500 ring-slate-200", label: "Soru girilmedi" },
} as const;

/** Konu eksik haritası: kaynakların konuları başarıya göre renkli; zayıf konular tek tıkla programa eklenir. */
export async function TopicMapCard({ centerId, studentId, today }: { centerId: string; studentId: string; today: string }) {
  const { groups, examCells } = await topicMap(centerId, studentId);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateString(today, i);
    return { date, label: `${i === 0 ? "Bugün" : i === 1 ? "Yarın" : WEEKDAY_SHORT[isoWeekday(date) - 1]} · ${date.slice(8)}.${date.slice(5, 7)}` };
  });
  const weak = groups
    .flatMap((g) => g.cells.filter((c) => c.level === "weak" || (c.flagged && c.level !== "good")).map((c) => ({ ...c, subject: g.subject })))
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, 8);
  const exam = examCells.slice(0, 6);
  if (!groups.length && !exam.length) {
    return (
      <Card>
        <CardHeader title="Konu eksik haritası" />
        <CardBody>
          <p className="text-sm text-slate-500">Öğrenciye kaynak ekleyip konu konu doğru-yanlış girildikçe harita oluşur; zayıf konuları buradan tek tıkla programa eklersiniz.</p>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Konu eksik haritası" description="Kaynaklardaki konu başarısı; görüşmede öncelikli işaretlenen konular çerçeveli." />
      <CardBody className="space-y-5">
        <ul className="flex flex-wrap gap-3 text-xs text-slate-600" aria-label="Renklerin anlamı">
          {(Object.keys(LEVEL) as (keyof typeof LEVEL)[]).map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <span className={cn("inline-block size-3 rounded ring-1", LEVEL[k].cls)} aria-hidden /> {LEVEL[k].label}
            </li>
          ))}
        </ul>
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-2 text-sm font-semibold text-ink-900">
              {g.title} <span className="font-normal text-slate-500">· {g.subject}</span>
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {g.cells.map((c) => (
                <Cell key={c.topic} c={c} />
              ))}
            </ul>
          </div>
        ))}
        {exam.length ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-900">Denemelerde zayıf konular</p>
            <ul className="flex flex-wrap gap-1.5">
              {exam.map((e) => (
                <li key={`${e.subject}-${e.topic}`} className={cn("rounded-lg px-2 py-1 text-xs ring-1", LEVEL.weak.cls)} title={`${e.subject} · %${Math.round(e.accuracy * 100)} doğru`}>
                  {e.topic} <b>%{Math.round(e.accuracy * 100)}</b>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {weak.length || exam.length ? (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="mb-3 text-sm font-bold text-ink-900">Öncelikli tekrar</p>
            <ul className="space-y-2">
              {weak.map((w) => (
                <li key={`${w.resourceId}-${w.topic}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-slate-800">
                    <b>{w.topic}</b> <span className="text-slate-500">· {w.subject}{w.accuracy !== null ? ` · %${Math.round(w.accuracy * 100)}` : ""}</span>
                  </span>
                  <AddTopicToPlanForm studentId={studentId} subject={w.subject} topic={w.topic} resourceId={w.resourceId} days={days} />
                </li>
              ))}
              {exam.map((e) => (
                <li key={`ex-${e.subject}-${e.topic}`} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 text-sm text-slate-800">
                    <b>{e.topic}</b> <span className="text-slate-500">· {e.subject} · deneme %{Math.round(e.accuracy * 100)}</span>
                  </span>
                  <AddTopicToPlanForm studentId={studentId} subject={e.subject} topic={e.topic} resourceId={null} days={days} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Cell({ c }: { c: TopicCell }) {
  return (
    <li
      className={cn("rounded-lg px-2 py-1 text-xs ring-1", LEVEL[c.level].cls, c.flagged && "ring-2 ring-ink-700")}
      title={`${c.topic}: ${c.accuracy === null ? "soru girilmedi" : `%${Math.round(c.accuracy * 100)} doğru`} · ${c.solved} soru${c.done ? " · bitti" : ""}${c.flagged ? " · görüşmede öncelikli" : ""}`}
    >
      {c.done ? "✓ " : ""}
      {c.topic}
      {c.accuracy !== null ? <b className="ml-1">%{Math.round(c.accuracy * 100)}</b> : null}
    </li>
  );
}

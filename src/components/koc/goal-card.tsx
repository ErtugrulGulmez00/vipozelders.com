import { Flag, Trophy } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatNet } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import type { GoalView } from "@/server/koc";
import { DeleteGoalButton, GoalForm } from "./koc-forms";

const dmy = (d: string) => d.split("-").reverse().join(".");

/** Hedef durumu: hedef net, son deneme ve ders ders kalan net; altında düzenleme formu. */
export function GoalCard({ studentId, goals, editable, portal = false }: { studentId: string; goals: GoalView[]; editable: boolean; portal?: boolean }) {
  if (!goals.length) {
    if (!editable) return null;
    return (
      <Card>
        <CardHeader title="Hedef" description={portal ? "Hedefini yaz: hangi derste kaç net gerektiğini ve ne kadar kaldığını görürsün." : "Hedef bölüm ya da puan için ders ders hedef net yazın; panel son denemeye göre ne kadar kaldığını gösterir."} />
        <CardBody>
          <GoalForm studentId={studentId} portal={portal} />
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title="Hedef" />
      <CardBody className="space-y-6">
        {goals.map((g) => {
          const progress = g.current ? Math.min(1, g.current.net / Math.max(g.targetNet, 1)) : 0;
          const reached = g.gap === 0;
          return (
            <div key={g.kind}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink-900">
                    <Flag className="size-4 text-brand-600" aria-hidden /> {g.label ?? `${g.kindLabel} hedefi`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {g.kindLabel} · hedef {formatNet(g.targetNet)} net
                    {g.current ? ` · son deneme ${formatNet(g.current.net)} net (${dmy(g.current.date)})` : " · henüz deneme yok"}
                  </p>
                </div>
                {editable && !portal ? <DeleteGoalButton studentId={studentId} kind={g.kind} /> : null}
              </div>
              {g.current ? (
                <>
                  <p className={cn("mt-3 flex items-center gap-2 font-display text-2xl font-extrabold", reached ? "text-emerald-700" : "text-ink-900")}>
                    {reached ? (
                      <>
                        <Trophy className="size-6" aria-hidden /> Hedefe ulaşıldı
                      </>
                    ) : (
                      <>Hedefe {formatNet(g.gap ?? 0)} net kaldı</>
                    )}
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Hedefin %${Math.round(progress * 100)} tamamlandı`}>
                    <div className={cn("h-full rounded-full", reached ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${(progress * 100).toFixed(1)}%` }} />
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {g.sections.map((s) => (
                      <li
                        key={s.name}
                        className={cn("rounded-lg px-2 py-1 text-xs", s.gap === 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}
                        title={`Hedef ${formatNet(s.target)}, son deneme ${s.current === null ? "—" : formatNet(s.current)}`}
                      >
                        {s.name} <b>{s.gap === null ? `${formatNet(s.target)} hedef` : s.gap === 0 ? "tamam" : `+${formatNet(s.gap)}`}</b>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
        {editable ? (
          <details className="rounded-2xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-brand-700">Hedefi düzenle ya da yeni sınav türü ekle</summary>
            <div className="mt-3">
              <GoalForm studentId={studentId} portal={portal} initial={{ kind: goals[0].kind, label: goals[0].label, sectionNets: goals[0].sectionNets }} />
            </div>
          </details>
        ) : null}
      </CardBody>
    </Card>
  );
}

import { Flag, Target, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatNet } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import { CHANCE_LABEL, CHANCE_TONE, formatPercentile, formatScore } from "@/lib/placement";
import type { GoalTarget, GoalView } from "@/server/koc";
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
          // Yalnızca hedef okul seçilmiş kayıt: net bölümü gösterilmez
          if (g.target && g.targetNet === 0) {
            return (
              <div key={g.kind} className="space-y-2">
                <TargetBlock target={g.target} kindLabel={g.kindLabel} />
                {editable && !portal ? (
                  <div className="flex justify-end">
                    <DeleteGoalButton studentId={studentId} kind={g.kind} />
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <div key={g.kind}>
              {g.target ? <TargetBlock target={g.target} kindLabel={g.kindLabel} className="mb-4" /> : null}
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

/** Hedef okul / program: tabanı, son deneme puanı ve kalan puan, yerleşme tahmini, son denemelerin gidişatı */
export function TargetBlock({ target: t, kindLabel, className }: { target: GoalTarget; kindLabel: string; className?: string }) {
  const above = t.gap !== null && t.gap <= 0;
  return (
    <div className={cn("rounded-2xl border border-brand-100 bg-brand-50/50 p-4", className)} data-testid="goal-target">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-700">
        <Target className="size-3.5" aria-hidden /> Hedef {t.exam === "LGS" ? "okul" : "program"}
      </p>
      <p className="mt-1 font-bold leading-snug text-ink-900">{t.name}</p>
      <p className="text-xs text-slate-500">
        {[t.place, `${t.year} tabanı ${formatScore(t.minScore)} puan`, t.exam === "YKS" && t.minRank ? `${t.minRank.toLocaleString("tr-TR")}. sıra` : null, t.exam === "LGS" && t.percentile !== null ? `yüzdelik ${formatPercentile(t.percentile)}` : null].filter(Boolean).join(" · ")}
      </p>
      {t.last === null ? (
        <p className="mt-3 text-sm text-slate-600">{kindLabel} denemelerine puan girildiğinde tabana ne kadar kaldığı burada görünür.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className={cn("font-display text-2xl font-extrabold", above ? "text-emerald-700" : "text-ink-900")}>
              {t.gap === null ? `Son puan ${formatScore(t.last)}` : above ? `Tabanın ${formatScore(Math.abs(t.gap))} puan üstünde` : `Tabana ${formatScore(t.gap)} puan kaldı`}
            </p>
            {t.chance ? <Badge tone={CHANCE_TONE[t.chance]}>{CHANCE_LABEL[t.chance]}</Badge> : null}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
            <span>Son {kindLabel} denemeleri:</span>
            {t.scores.map((x, i) => (
              <span key={`${x.date}-${i}`} className={cn("tabular-nums", i === t.scores.length - 1 && "font-bold text-ink-900")} title={x.name}>
                {i ? "→ " : ""}
                {formatScore(x.score)}
              </span>
            ))}
            {t.trend !== null && t.trend !== 0 ? (
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", t.trend > 0 ? "text-emerald-700" : "text-rose-700")}>
                {t.trend > 0 ? <TrendingUp className="size-3.5" aria-hidden /> : <TrendingDown className="size-3.5" aria-hidden />}
                {t.trend > 0 ? "+" : "−"}
                {formatScore(Math.abs(t.trend))}
              </span>
            ) : null}
          </p>
        </>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Deneme puanı yayınevine göre değişir; tahmin geçen yılın tabanına göredir.</p>
    </div>
  );
}

import { TrendingDown, TrendingUp } from "lucide-react";
import { EXAM_PRESETS, formatNet } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import type { NetProgress } from "@/server/center/net-progress";

const dmy = (iso: string) => iso.split("-").reverse().join(".");

function Change({ value, big = false }: { value: number | null; big?: boolean }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  const up = value > 0;
  const tone = value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-slate-500";
  return (
    <span className={cn("inline-flex items-center gap-1 font-bold tabular-nums", tone, big && "text-lg")}>
      {value > 0 ? <TrendingUp className="size-4" aria-hidden /> : value < 0 ? <TrendingDown className="size-4" aria-hidden /> : null}
      {up ? "+" : ""}
      {formatNet(value)}
    </span>
  );
}

/** Başlangıç–son net karşılaştırması: deneme türü başına ilk ve son deneme, ders ders değişim. */
export function NetProgressTable({ items, compact = false }: { items: NetProgress[]; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="space-y-4">
      {items.map((p) => (
        <div key={p.kind} className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-semibold text-ink-900">{EXAM_PRESETS[p.kind].label} · başlangıçtan bugüne</p>
              <p className="text-xs text-slate-500">
                {p.count} deneme · ilk: {dmy(p.first.date)} · son: {dmy(p.last.date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">
                Toplam net {formatNet(p.first.net)} → <b className="text-ink-900">{formatNet(p.last.net)}</b>
              </p>
              <Change value={p.change} big />
            </div>
          </div>
          {compact ? null : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">Ders</th>
                    <th className="px-2 py-2 text-right">Başlangıç</th>
                    <th className="px-2 py-2 text-right">Son</th>
                    <th className="px-4 py-2 text-right">Değişim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {p.sections.map((s) => (
                    <tr key={s.name}>
                      <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-slate-600">{s.first === null ? "—" : formatNet(s.first)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink-900">{s.last === null ? "—" : formatNet(s.last)}</td>
                      <td className="px-4 py-2 text-right">
                        <Change value={s.change} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

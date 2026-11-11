// Pi Koç grafikleri: JavaScript gerektirmeyen SVG. Tek seri, tek renk (marka); değer üzerine gelince görünür (title).
import { cn } from "@/lib/cn";

const BRAND = "#d63f1c";
const GRID = "#e2e8f0";
const AXIS = "#64748b";
const INK = "#1b1f3b";

const fmt = (n: number, digits = 1) => n.toLocaleString("tr-TR", { maximumFractionDigits: digits });

/** Kart içinde küçük eğilim çizgisi (son değer noktalı). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <div className={cn("h-8", className)} aria-hidden />;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => 2 + (i * (w - 4)) / (values.length - 1);
  const y = (v: number) => 4 + (1 - (v - min) / span) * (h - 8);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-full", className)} role="img" aria-label={`Net eğilimi: ${values.map((v) => fmt(v)).join(", ")}`}>
      <path d={`${d} L${x(last)},${h} L${x(0)},${h} Z`} fill={BRAND} opacity="0.08" />
      <path d={d} fill="none" stroke={BRAND} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r="3" fill={BRAND} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/** Çizgi + alan grafiği (ör. deneme netleri). */
/** target: hedef değer (kesikli yatay çizgi) */
export function LineChart({ points, label, unit = "net", max, target }: { points: { label: string; sub?: string; value: number }[]; label: string; unit?: string; max?: number; target?: number | null }) {
  if (points.length < 2) return <p className="py-8 text-center text-sm text-slate-500">Grafik için en az iki kayıt gerekir.</p>;
  const width = 640;
  const height = 240;
  const pad = { left: 40, right: 20, top: 24, bottom: 46 };
  const top = Math.max(max ?? 0, target ?? 0, ...points.map((p) => p.value), 1);
  const niceTop = Math.ceil(top / 5) * 5;
  const x = (i: number) => pad.left + (i * (width - pad.left - pad.right)) / (points.length - 1);
  const y = (v: number) => pad.top + (1 - Math.max(0, v) / niceTop) * (height - pad.top - pad.bottom);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const base = height - pad.bottom;
  const ticks = [0, 0.5, 1].map((t) => Math.round(niceTop * t));
  const anchor = (i: number) => (i === 0 ? "start" : i === points.length - 1 ? "end" : "middle");
  const best = Math.max(...points.map((p) => p.value));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id="koc-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={BRAND} stopOpacity="0.22" />
          <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
          <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>
            {t}
          </text>
        </g>
      ))}
      {target ? (
        <g>
          <title>{`Hedef: ${fmt(target, 2)} ${unit}`}</title>
          <line x1={pad.left} x2={width - pad.right} y1={y(target)} y2={y(target)} stroke={INK} strokeWidth="1.5" strokeDasharray="6 5" opacity="0.55" />
          <text x={width - pad.right} y={y(target) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill={INK} opacity="0.75">
            Hedef {fmt(target)}
          </text>
        </g>
      ) : null}
      <path d={`${d} L${x(points.length - 1)},${base} L${x(0)},${base} Z`} fill="url(#koc-area)" />
      <path d={d} fill="none" stroke={BRAND} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        const showValue = i === points.length - 1 || p.value === best;
        return (
          <g key={`${p.label}-${i}`}>
            <title>{`${p.label}${p.sub ? ` · ${p.sub}` : ""}: ${fmt(p.value, 2)} ${unit}`}</title>
            <rect x={x(i) - 18} y={pad.top} width="36" height={base - pad.top} fill="transparent" />
            <circle cx={x(i)} cy={y(p.value)} r="4.5" fill="#fff" stroke={BRAND} strokeWidth="2.5" />
            {showValue ? (
              <text x={x(i)} y={y(p.value) - 11} textAnchor={anchor(i)} fontSize="12" fontWeight="700" fill={INK}>
                {fmt(p.value)}
              </text>
            ) : null}
            <text x={x(i)} y={base + 18} textAnchor={anchor(i)} fontSize="10.5" fill="#475569">
              {p.label.length > 14 ? `${p.label.slice(0, 13)}…` : p.label}
            </text>
            {p.sub ? (
              <text x={x(i)} y={base + 32} textAnchor={anchor(i)} fontSize="10" fill="#94a3b8">
                {p.sub}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Dikey sütun grafiği (ör. haftalık çözülen soru). Son sütun vurgulanır. */
export function BarChart({ bars, label, unit = "soru", height = 200 }: { bars: { label: string; value: number; hint?: string }[]; label: string; unit?: string; height?: number }) {
  const width = 640;
  const pad = { left: 36, right: 8, top: 22, bottom: 28 };
  const top = Math.max(...bars.map((b) => b.value), 1);
  const niceTop = Math.ceil(top / 10) * 10 || 10;
  const slot = (width - pad.left - pad.right) / bars.length;
  const barW = Math.min(44, slot - 8);
  const base = height - pad.bottom;
  const y = (v: number) => pad.top + (1 - v / niceTop) * (base - pad.top);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={width - pad.right} y1={y(niceTop * t)} y2={y(niceTop * t)} stroke={GRID} />
          <text x={pad.left - 6} y={y(niceTop * t) + 4} textAnchor="end" fontSize="11" fill={AXIS}>
            {Math.round(niceTop * t)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const cx = pad.left + slot * i + slot / 2;
        const h = Math.max(0, base - y(b.value));
        const last = i === bars.length - 1;
        const r = Math.min(4, h / 2);
        const x0 = cx - barW / 2;
        const top = base - h;
        return (
          <g key={`${b.label}-${i}`}>
            <title>{`${b.hint ?? b.label}: ${fmt(b.value, 0)} ${unit}`}</title>
            <rect x={cx - slot / 2} y={pad.top} width={slot} height={base - pad.top} fill="transparent" />
            {h > 0 ? (
              <path
                d={`M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base} Z`}
                fill={BRAND}
                opacity={last ? 1 : 0.45}
              />
            ) : null}
            {last || b.value === top ? (
              <text x={cx} y={top - 6} textAnchor="middle" fontSize="11.5" fontWeight="700" fill={INK}>
                {fmt(b.value, 0)}
              </text>
            ) : null}
            <text x={cx} y={base + 17} textAnchor="middle" fontSize="10.5" fill="#475569">
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Yatay çubuk listesi (ör. ders netleri, ders bazında soru). */
export function HBarList({ rows }: { rows: { label: string; value: number; max: number; display: string; hint?: string }[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const ratio = r.max > 0 ? Math.min(1, Math.max(0, r.value / r.max)) : 0;
        return (
          <li key={r.label} title={r.hint}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium text-slate-700">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-ink-900">{r.display}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${(ratio * 100).toFixed(1)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Halka gösterge (ör. haftalık program tamamlama). */
export function Ring({ value, size = 96, label, caption }: { value: number; size?: number; label: string; caption?: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${label}: %${Math.round(v * 100)}`} className="shrink-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="11" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={BRAND} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(c * v).toFixed(1)} ${c.toFixed(1)}`} />
        <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" fontSize="21" fontWeight="800" fill={INK}>
          %{Math.round(v * 100)}
        </text>
      </svg>
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {caption ? <p className="text-xs text-slate-500">{caption}</p> : null}
      </div>
    </div>
  );
}

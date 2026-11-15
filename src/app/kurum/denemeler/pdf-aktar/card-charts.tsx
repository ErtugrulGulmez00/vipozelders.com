import type { CardTopic, StudentCard } from "@/lib/center/exam-pdf-card";

// Karne grafikleri. Renkler renk körlüğü denetiminden geçti: doğru deniz yeşili, yanlış gül kırmızısı, boş gri (boşluk).
const C = { correct: "#0d9488", wrong: "#e11d48", blank: "#e2e8f0" };
const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {(
        [
          ["Doğru", C.correct],
          ["Yanlış", C.wrong],
          ["Boş", C.blank],
        ] as const
      ).map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

/** Tüm soruların doğru / yanlış / boş dağılımı (halka) */
export function AnswerDonut({ card }: { card: StudentCard }) {
  const correct = card.sections.reduce((t, s) => t + s.correct, 0);
  const wrong = card.sections.reduce((t, s) => t + s.wrong, 0);
  const blank = card.sections.reduce((t, s) => t + s.blank, 0);
  const total = correct + wrong + blank;
  if (!total) return null;
  const r = 42;
  const len = 2 * Math.PI * r;
  const gap = 2;
  let offset = 0;
  const parts = [
    { label: "Doğru", value: correct, color: C.correct },
    { label: "Yanlış", value: wrong, color: C.wrong },
    { label: "Boş", value: blank, color: C.blank },
  ].filter((p) => p.value > 0);
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-28 shrink-0 -rotate-90" role="img" aria-label={`${total} sorunun ${correct}'i doğru, ${wrong}'i yanlış, ${blank}'i boş`}>
        {parts.map((p) => {
          const dash = Math.max(0, (p.value / total) * len - (parts.length > 1 ? gap : 0));
          const el = (
            <circle key={p.label} cx="50" cy="50" r={r} fill="none" stroke={p.color} strokeWidth="12" strokeDasharray={`${dash} ${len - dash}`} strokeDashoffset={-offset}>
              <title>{`${p.label}: ${p.value} soru`}</title>
            </circle>
          );
          offset += (p.value / total) * len;
          return el;
        })}
        <text x="50" y="47" textAnchor="middle" className="rotate-90 fill-ink-900 font-display text-[19px] font-extrabold" style={{ transformOrigin: "50px 50px" }}>
          %{Math.round((correct / total) * 100)}
        </text>
        <text x="50" y="62" textAnchor="middle" className="rotate-90 fill-slate-500 text-[9px]" style={{ transformOrigin: "50px 50px" }}>
          doğru
        </text>
      </svg>
      <dl className="space-y-1 text-sm">
        {[
          ["Doğru", correct, C.correct],
          ["Yanlış", wrong, C.wrong],
          ["Boş", blank, C.blank],
        ].map(([label, value, color]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: color as string }} aria-hidden />
            <dt className="w-12 text-slate-600">{label}</dt>
            <dd className="font-bold tabular-nums text-ink-900">{value}</dd>
          </div>
        ))}
        <div className="pt-1 text-xs text-slate-500">{total} sorudan</div>
      </dl>
    </div>
  );
}

/** Sınıf / kurum / il / genel sıralamaları yüzdelik dilim çubuğu olarak */
export function RankBars({ card }: { card: StudentCard }) {
  const rows = [
    { label: "Bu PDF", rank: card.rank, of: card.of },
    ...card.ranks.filter((r): r is { label: string; rank: number; of: number } => !!r.of && r.of > 1).map((r) => ({ label: r.label.replace(/\s*sıra(sı)?\s*/i, "") || r.label, rank: r.rank, of: r.of })),
  ].filter((r) => r.of > 1);
  if (!rows.length) return null;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const top = Math.max(1, Math.ceil((r.rank / r.of) * 100));
        const pos = r.of > 1 ? 1 - (r.rank - 1) / (r.of - 1) : 1;
        return (
          <div key={r.label} title={`${r.label}: ${r.rank}/${r.of}`}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-slate-700">{r.label}</span>
              <span className="tabular-nums text-slate-500">
                {r.rank}/{r.of} · <b className="text-ink-900">ilk %{top}</b>
              </span>
            </div>
            <div className="relative mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pos * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Her soru bir kare: ders ders, konu konu gruplanmış doğru / yanlış / boş haritası */
export function TopicWaffle({ topics }: { topics: CardTopic[] }) {
  const bySection = new Map<string, CardTopic[]>();
  for (const t of topics) bySection.set(t.section, [...(bySection.get(t.section) ?? []), t]);
  return (
    <div className="space-y-3">
      {[...bySection.entries()].map(([section, list]) => (
        <div key={section} className="sm:flex sm:gap-3">
          <p className="mb-1 w-32 shrink-0 truncate text-xs font-medium text-slate-700 sm:mb-0 sm:pt-0.5">{section}</p>
          <div className="flex flex-wrap gap-x-2 gap-y-1.5">
            {list.map((t) => (
              <span key={t.topic} className="flex gap-0.5" title={`${t.topic}: ${t.correct} doğru, ${t.wrong} yanlış, ${t.blank} boş`}>
                {[...Array(t.correct).fill(C.correct), ...Array(t.wrong).fill(C.wrong), ...Array(t.blank).fill(C.blank)].map((color, i) => (
                  <span key={i} className="size-3 rounded-[3px]" style={{ background: color }} />
                ))}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Hedef: en çok kaçırılan 5 konu toparlanırsa toplam net */
export function PotentialBar({ card }: { card: StudentCard }) {
  if (card.potentialNet <= 0) return null;
  const max = Math.max(card.totalNet + card.potentialNet, card.avgTotalNet, 1);
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / max) * 100))}%`;
  return (
    <div className="mt-6 rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-100">
      <p className="text-sm text-teal-950">
        En çok kaçırılan <b>5 konuyu</b> toparlarsa <b className="text-teal-800">+{fmt(card.potentialNet)} net</b> kazanır, toplamı{" "}
        <b>{fmt(card.totalNet + card.potentialNet)}</b> olur.
      </p>
      <div className="relative mt-3 h-3 rounded-full bg-white">
        <div className="absolute inset-y-0 left-0 rounded-full bg-teal-200" style={{ width: pct(card.totalNet + card.potentialNet) }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-teal-600" style={{ width: pct(card.totalNet) }} />
        <span className="absolute -top-1 h-5 w-0.5 rounded bg-ink-900/60" style={{ left: `calc(${pct(card.avgTotalNet)} - 1px)` }} title={`PDF ortalaması ${fmt(card.avgTotalNet)}`} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-teal-900">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-teal-600" /> Şu an {fmt(card.totalNet)}</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-teal-200" /> Hedef</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded bg-ink-900/60" /> PDF ortalaması</span>
      </div>
    </div>
  );
}

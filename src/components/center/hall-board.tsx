"use client";

import { Check, Library, Minus, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { quickCreateHallAction, saveHallDayAction } from "@/actions/center/study-hall";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { normalizeSearch } from "@/lib/text";

// Çalışma salonu: tek tıkla kurulum ve günlük yoklama panosu.

/** Salon yokken: ad ve periyot yazdırmadan tek tıkla kurulum. */
export function QuickHallSetup({ studentCount }: { studentCount: number }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
        <div>
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Library className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-xl font-extrabold text-ink-900">Çalışma salonunu tek tıkla kurun</h2>
          <p className="mt-1 max-w-lg text-sm text-slate-600">
            Hazır periyotlarla (09:00–20:45, 10 periyot) salon açılır, öğrencileriniz listeye gelir. Sonra her gün tabloda kimin geldiğini tek dokunuşla işaretlersiniz.
          </p>
          <ul className="mt-4 grid gap-1.5 text-sm text-slate-700 sm:grid-cols-2">
            {["Gün gün yoklama tablosu", "Haftalık geldi / gelmedi görünümü", "Gelmeyenin velisine bildirim", "Periyotlar sonradan değiştirilebilir"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-teal-600" aria-hidden /> {t}
              </li>
            ))}
          </ul>
        </div>
        <ActionForm action={quickCreateHallAction} className="space-y-3 rounded-2xl bg-slate-50 p-4 sm:w-72">
          <Checkbox name="addAll" defaultChecked label={`Tüm aktif öğrencileri ekle (${studentCount})`} />
          <SubmitButton size="lg" className="w-full">
            <Sparkles className="size-4" aria-hidden /> Salonu kur
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

type Mark = "G" | "Y" | "-";
const NEXT: Record<Mark, Mark> = { "-": "G", G: "Y", Y: "-" };
const LABEL: Record<Mark, string> = { G: "Geldi", Y: "Gelmedi", "-": "İşaretlenmedi" };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase("tr"))
    .join("");
}

function Cell({ value, onClick, label }: { value: Mark; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${LABEL[value]}`}
      title={LABEL[value]}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-xl transition active:scale-95",
        value === "G" && "bg-teal-600 text-white shadow-sm hover:bg-teal-700",
        value === "Y" && "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
        value === "-" && "border border-dashed border-slate-300 bg-white text-slate-300 hover:border-slate-400 hover:text-slate-400",
      )}
    >
      {value === "G" ? <Check className="size-4" strokeWidth={3} aria-hidden /> : value === "Y" ? <X className="size-4" strokeWidth={3} aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
    </button>
  );
}

/** Günlük yoklama: özet kartları, periyot tablosu (dokununca — → geldi → gelmedi), satır/sütun hızlı doldurma. */
export function HallBoard({ hallId, date, periods, students }: { hallId: string; date: string; periods: string[]; students: { id: string; name: string; deskNo: string | null; marks: string }[] }) {
  const initial = useMemo(() => Object.fromEntries(students.map((s) => [s.id, periods.map((_, i) => (["G", "Y"].includes(s.marks[i]) ? s.marks[i] : "-") as Mark)])), [students, periods]);
  const [marks, setMarks] = useState<Record<string, Mark[]>>(initial);
  const [query, setQuery] = useState("");
  const [onlyUnmarked, setOnlyUnmarked] = useState(false);
  const q = normalizeSearch(query);
  const visible = students.filter((s) => (!q || normalizeSearch(`${s.name} ${s.deskNo ?? ""}`).includes(q)) && (!onlyUnmarked || marks[s.id].every((v) => v === "-")));
  const dirty = JSON.stringify(marks) !== JSON.stringify(initial);
  const set = (id: string, i: number, value: Mark) => setMarks((m) => ({ ...m, [id]: m[id].map((v, j) => (j === i ? value : v)) }));
  const fillColumn = (i: number, value: Mark) => setMarks((m) => Object.fromEntries(Object.entries(m).map(([id, row]) => [id, row.map((v, j) => (j === i ? value : v))])));
  const fillRow = (id: string, value: Mark) => setMarks((m) => ({ ...m, [id]: m[id].map(() => value) }));

  const rows = Object.values(marks);
  const came = rows.filter((r) => r.includes("G")).length;
  const absentAll = rows.filter((r) => r.some((v) => v !== "-") && !r.includes("G")).length;
  const unmarked = rows.filter((r) => r.every((v) => v === "-")).length;
  const present = rows.reduce((t, r) => t + r.filter((v) => v === "G").length, 0);
  const marked = rows.reduce((t, r) => t + r.filter((v) => v !== "-").length, 0);
  const rate = marked ? Math.round((present / marked) * 100) : null;

  return (
    <ActionForm action={saveHallDayAction} className="space-y-4">
      <input type="hidden" name="hallId" value={hallId} />
      <input type="hidden" name="date" value={date} />
      {students.map((s) => (
        <span key={s.id}>
          <input type="hidden" name="studentIds" value={s.id} />
          <input type="hidden" name={`marks:${s.id}`} value={marks[s.id].join("")} />
        </span>
      ))}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Geldi" value={came} of={students.length} tone="teal" />
        <Stat label="Hiç gelmedi" value={absentAll} of={students.length} tone="rose" />
        <Stat label="İşaretlenmedi" value={unmarked} of={students.length} tone="slate" />
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periyot doluluğu</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{rate === null ? "—" : `%${rate}`}</p>
          <div className="mt-2 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-teal-600" style={{ width: `${rate ?? 0}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İsim ya da masa no ara" aria-label="Salondaki öğrencilerde ara" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyUnmarked} onChange={(e) => setOnlyUnmarked(e.target.checked)} className="size-4 accent-brand-600" />
          Yalnızca işaretlenmeyenler
        </label>
        {visible.length !== students.length ? <span className="text-xs text-slate-500">{visible.length} öğrenci gösteriliyor</span> : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="text-slate-600">
              <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Öğrenci</th>
              {periods.map((p, i) => {
                const n = rows.filter((r) => r[i] === "G").length;
                return (
                  <th key={p} className="border-b border-slate-200 bg-slate-50 px-1 py-2 text-center font-medium">
                    <p className="font-semibold text-slate-800">{p.slice(0, 5)}</p>
                    <p className="text-[10px] text-slate-400">{p.slice(6)}</p>
                    <button type="button" onClick={() => fillColumn(i, "G")} className="mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 hover:bg-teal-50" title="Bu periyotta herkes geldi">
                      {n}/{students.length} ✓
                    </button>
                  </th>
                );
              })}
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Gün</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, idx) => {
              const row = marks[s.id];
              const g = row.filter((v) => v === "G").length;
              return (
                <tr key={s.id} className={idx % 2 ? "bg-slate-50/50" : undefined}>
                  <td className={cn("sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 px-4 py-2", idx % 2 ? "bg-slate-50" : "bg-white")}>
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">{initials(s.name)}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {s.deskNo ? `Masa ${s.deskNo} · ` : ""}
                          <button type="button" className="font-semibold text-teal-700 hover:underline" onClick={() => fillRow(s.id, "G")}>
                            tüm gün geldi
                          </button>
                          {" · "}
                          <button type="button" className="font-semibold text-rose-700 hover:underline" onClick={() => fillRow(s.id, "Y")}>
                            gelmedi
                          </button>
                        </p>
                      </div>
                    </div>
                  </td>
                  {periods.map((p, i) => (
                    <td key={p} className="border-b border-slate-100 px-1 py-2 text-center">
                      <Cell value={row[i]} onClick={() => set(s.id, i, NEXT[row[i]])} label={`${s.name} ${p}`} />
                    </td>
                  ))}
                  <td className="border-b border-slate-100 px-3 py-2">
                    <div className="flex w-20 items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-teal-600" style={{ width: `${(g / periods.length) * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-slate-600">
                        {g}/{periods.length}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded bg-teal-600 text-white">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          Geldi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded bg-rose-600 text-white">
            <X className="size-3" strokeWidth={3} aria-hidden />
          </span>
          Gelmedi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-4 rounded border border-dashed border-slate-300" /> İşaretlenmedi
        </span>
        <span>Kutuya dokundukça değişir; başlıktaki ✓ o periyotta herkesi “geldi” yapar.</span>
      </div>

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <Checkbox name="notify" label="Gün boyu hiç gelmeyenlerin velisine bildirim gönder" />
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-xs font-semibold text-amber-700">Kaydedilmemiş değişiklik var</span> : null}
          <SubmitButton size="lg">Yoklamayı kaydet</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}

function Stat({ label, value, of, tone }: { label: string; value: number; of: number; tone: "teal" | "rose" | "slate" }) {
  const color = { teal: "text-teal-700", rose: "text-rose-700", slate: "text-slate-500" }[tone];
  const bar = { teal: "bg-teal-600", rose: "bg-rose-600", slate: "bg-slate-300" }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-extrabold", color)}>
        {value}
        <span className="text-sm font-semibold text-slate-400">/{of}</span>
      </p>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className={cn("h-2 rounded-full", bar)} style={{ width: `${of ? (value / of) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Tarayıcının kendi tarih kutusu tarayıcı diline göre (ör. AA/GG/YYYY) görünür. Bu alan her zaman GG.AA.YYYY gösterir,
// Pazartesi'den başlayan Türkçe takvim açar; forma yine YYYY-AA-GG gönderir (sunucu tarafı değişmez).

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const isIso = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const toDisplay = (v: string) => (isIso(v) ? `${v.slice(8)}.${v.slice(5, 7)}.${v.slice(0, 4)}` : "");

function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });
}

/** "7.11.2026", "07/11/2026", "7-11-26" → "2026-11-07"; geçersizse null */
export function parseTurkishDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const month = Number(m[2]) - 1;
  const day = Number(m[1]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return iso(year, month, day);
}

type Props = {
  name?: string;
  id?: string;
  defaultValue?: string;
  /** Denetimli kullanım: değer YYYY-AA-GG */
  value?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function DateInput({ name, id, defaultValue = "", value: controlled, onValueChange, min, max, required, disabled, className, "aria-label": ariaLabel }: Props) {
  const [inner, setInner] = useState(isIso(defaultValue) ? defaultValue : "");
  const value = controlled !== undefined ? controlled : inner;
  // Yazarken taslak metin; yazılmıyorken değerin GG.AA.YYYY gösterimi
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? toDisplay(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const base = isIso(value) ? value : todayIso();
    return { y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 };
  });
  const box = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const inputId = id ?? autoId;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const allowed = (v: string) => (!min || v >= min) && (!max || v <= max);
  function commit(next: string) {
    if (controlled === undefined) setInner(next);
    onValueChange?.(next);
    setDraft(null);
  }
  function openAt(v: string) {
    const base = isIso(v) ? v : todayIso();
    setView({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
    setOpen(true);
  }

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const today = todayIso();
  const shift = (delta: number) => setView((v) => ({ y: v.y + Math.floor((v.m + delta) / 12), m: (((v.m + delta) % 12) + 12) % 12 }));

  return (
    <div
      ref={box}
      className={cn("relative", className)}
      // Odak bileşenin dışına çıkınca (Tab, başka alan) takvim kapanır
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="GG.AA.YYYY"
          aria-label={ariaLabel}
          disabled={disabled}
          value={text}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d./\-\s]/g, "").slice(0, 10))}
          onFocus={() => openAt(value)}
          onBlur={() => {
            if (!text.trim()) return commit("");
            const parsed = parseTurkishDate(text);
            if (parsed && allowed(parsed)) commit(parsed);
            else setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
              setOpen(false);
            }
          }}
          className="block h-11 w-full rounded-xl border border-slate-300 bg-white pl-3.5 pr-10 text-sm text-ink-900 shadow-xs placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openAt(value))}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-brand-600"
          aria-label="Takvimi aç"
        >
          <CalendarDays className="size-4" aria-hidden />
        </button>
      </div>
      {/* Forma giden değer (YYYY-AA-GG); otomatik testler de buraya yazabilir */}
      <input
        type="text"
        name={name}
        value={value}
        required={required}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => isIso(e.target.value) && commit(e.target.value)}
        className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
      />
      {open ? (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-72 rounded-2xl border border-ink-100 bg-white p-3 shadow-xl" role="dialog" aria-label="Tarih seçin">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-slate-100" aria-label="Önceki ay">
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <p className="text-sm font-bold text-ink-900">
              {MONTHS[view.m]} {view.y}
            </p>
            <button type="button" onClick={() => shift(1)} className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-slate-100" aria-label="Sonraki ay">
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {DAYS.map((d) => (
              <span key={d} className="py-1 text-[11px] font-semibold text-slate-400">
                {d}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={`b${i}`} />;
              const v = iso(view.y, view.m, day);
              const ok = allowed(v);
              return (
                <button
                  key={v}
                  type="button"
                  disabled={!ok}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    commit(v);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-9 rounded-lg text-sm tabular-nums",
                    v === value ? "bg-brand-600 font-bold text-white" : v === today ? "font-bold text-brand-700 ring-1 ring-brand-300" : "text-slate-700 hover:bg-slate-100",
                    !ok && "cursor-not-allowed text-slate-300 hover:bg-transparent",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
            {required ? <span /> : (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { commit(""); setOpen(false); }} className="text-slate-500 hover:text-ink-900">
                Temizle
              </button>
            )}
            {allowed(today) ? (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { commit(today); setOpen(false); }} className="text-brand-700 hover:underline">
                Bugün
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { Printer, X } from "lucide-react";
import { useEffect } from "react";
import type { MatchRow } from "./pdf-forms";

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/** PDF'teki öğrencinin anlık karnesi: sisteme kayıtlı olmasa da ders netleri, sıra, puan ve eksik konular. */
export function StudentCardDialog({ examName, row, onClose }: { examName: string; row: MatchRow; onClose: () => void }) {
  const card = row.card;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const diff = Math.round((card.totalNet - card.avgTotalNet) * 100) / 100;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      {/* Yazdırırken yalnızca karne basılır */}
      <style>{`@media print { body * { visibility: hidden !important; } #pdf-karne, #pdf-karne * { visibility: visible !important; } #pdf-karne { position: absolute; inset: 0; max-height: none !important; overflow: visible !important; box-shadow: none !important; } .karne-no-print { display: none !important; } }`}</style>
      <div
        id="pdf-karne"
        role="dialog"
        aria-modal="true"
        aria-label={`${row.name || "Adsız form"} karnesi`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{examName}</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-ink-900">{row.name || "Adsız form"}</h2>
            <p className="text-sm text-slate-500">
              No {row.number || "—"} · {row.className || "sınıf yok"}
              {row.studentId ? "" : " · sisteme kayıtlı değil"}
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="karne-no-print inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Yazdır">
            <Printer className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={onClose} className="karne-no-print inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Kapat">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-brand-600 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-100">Toplam net</p>
            <p className="mt-1 font-display text-3xl font-extrabold">{fmt(card.totalNet)}</p>
            <p className="text-xs text-brand-100">
              PDF ortalaması {fmt(card.avgTotalNet)} ({diff >= 0 ? "+" : ""}
              {fmt(diff)})
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bu PDF&apos;te sıra</p>
            <p className="mt-1 font-display text-3xl font-extrabold text-ink-900">
              {card.rank}
              <span className="text-base font-semibold text-slate-400">/{card.of}</span>
            </p>
          </div>
          {card.score ? (
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puan</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink-900">{fmt(card.score)}</p>
            </div>
          ) : null}
        </div>

        {card.ranks.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {card.ranks.map((r) => (
              <span key={r.label} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                {/sıra/i.test(r.label) ? r.label : `${r.label} sırası`}: {r.rank}
                {r.of ? `/${r.of}` : ""}
              </span>
            ))}
          </div>
        ) : null}

        <h3 className="mt-6 text-sm font-bold text-ink-900">Ders ders sonuçlar</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2">Ders</th>
                <th className="px-2 py-2 text-right">D</th>
                <th className="px-2 py-2 text-right">Y</th>
                <th className="px-2 py-2 text-right">B</th>
                <th className="px-2 py-2 text-right">Net</th>
                <th className="w-32 py-2 pl-3">Başarı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {card.sections.map((s) => {
                const rate = s.questions ? Math.max(0, Math.min(1, s.net / s.questions)) : 0;
                const avgRate = s.questions ? Math.max(0, Math.min(1, s.avgNet / s.questions)) : 0;
                return (
                  <tr key={s.name}>
                    <td className="py-2 pr-2 font-medium text-slate-800">
                      {s.name} <span className="text-xs font-normal text-slate-400">{s.questions} soru</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-700">{s.correct}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-rose-700">{s.wrong}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{s.blank}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums text-ink-900">{fmt(s.net)}</td>
                    <td className="py-2 pl-3">
                      <div className="relative h-2.5 rounded-full bg-slate-100" title={`Ortalama net ${fmt(s.avgNet)}`}>
                        <div className="h-2.5 rounded-full bg-brand-500" style={{ width: `${rate * 100}%` }} />
                        <span className="absolute -top-1 h-4.5 w-0.5 rounded bg-ink-900/60" style={{ left: `calc(${avgRate * 100}% - 1px)` }} aria-hidden />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-slate-400">Çubuktaki çizgi bu PDF&apos;teki öğrencilerin ortalama netini gösterir.</p>

        <h3 className="mt-6 text-sm font-bold text-ink-900">
          Eksik konular{card.weakTopics.length ? <span className="font-normal text-slate-500"> · {card.weakTopics.length} konu, en çok soru kaçırılan önce</span> : null}
        </h3>
        {card.weakTopics.length ? (
          <ul className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
            {card.weakTopics.map((t) => (
              <li key={`${t.section}-${t.topic}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-slate-800">{t.topic}</span>
                  <span className="block text-xs text-slate-500">{t.section}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-600">
                  {t.wrong ? <b className="text-rose-700">{t.wrong} yanlış</b> : null}
                  {t.wrong && t.blank ? ", " : null}
                  {t.blank ? `${t.blank} boş` : null} / {t.questions} soru
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {card.sections.length ? "Konu analizi için PDF'te cevap anahtarı ve kazanım bilgisi olmalı; bu PDF'te yok ya da öğrenci tüm konularda doğru yapmış." : "Bu öğrenci için ders sonucu okunamadı."}
          </p>
        )}
        {!row.studentId ? (
          <p className="karne-no-print mt-5 rounded-xl bg-violet-50 px-4 py-3 text-xs text-violet-900">
            Bu öğrenci sisteminizde kayıtlı değil. Karne şimdilik yalnızca bu ekranda; öğrenciyi ekleyip eşleştirirseniz sonuçları kalıcı olarak öğrencinin sayfasına aktarılır.
          </p>
        ) : null}
      </div>
    </div>
  );
}

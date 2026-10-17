"use client";

import { ShieldAlert, X } from "lucide-react";
import { useState, useTransition } from "react";
import { reportClassroomAction } from "@/actions/classroom";
import { REPORT_REASONS } from "@/lib/classroom-report";

/** Dersteki herkesin görebildiği "Uygunsuz durum bildir": onaylanınca oda kapanır ve yöneticiye acil bildirim gider. */
export function ReportButton({ bookingId, onSending, onDone, className }: { bookingId: string; onSending?: () => void; onDone: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      // Oda sunucuda kapanınca bağlantı hemen kopar; yönlendirme bildirimin gittiğini bilmeli.
      onSending?.();
      const result = await reportClassroomAction(bookingId, reason, details);
      if (result.ok) onDone();
      else setError(result.error ?? "Bildirim gönderilemedi.");
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <ShieldAlert className="size-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Uygunsuz durum bildir</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-800 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="report-title" className="text-lg font-bold text-slate-900">
                Uygunsuz durum bildir
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Kapat">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">Gönderdiğinizde ders hemen sona erer ve ekibimize acil bildirim gider. Gerekirse öğretmenin hesabı inceleme süresince askıya alınır.</p>
            <fieldset className="space-y-2">
              <legend className="sr-only">Neden</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="mt-0.5" />
                  {r}
                </label>
              ))}
            </fieldset>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ne oldu? (isteğe bağlı)"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Vazgeç
              </button>
              <button type="button" disabled={!reason || pending} onClick={submit} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {pending ? "Gönderiliyor…" : "Bildir ve dersi bitir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

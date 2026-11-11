"use client";

import { Pause, Play, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { kocAddStudyAction, kocDeletePaymentAction, kocDeleteStudyAction, kocRecordPaymentAction, portalAddStudyAction, portalDeleteStudyAction } from "@/actions/koc";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { DateInput } from "@/components/ui/date-input";
import { Field, Input, Select } from "@/components/ui/form";

// Pi Koç: çalışma sayacı / elle süre girişi ve koçun tahsilat düğmeleri.

type Timer = { startedAt: number | null; elapsed: number; subject: string };
const EMPTY: Timer = { startedAt: null, elapsed: 0, subject: "" };

function readTimer(key: string): Timer {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Timer) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeTimer(key: string, t: Timer) {
  try {
    if (!t.startedAt && !t.elapsed) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(t));
  } catch {
    /* tarayıcı depolaması kapalıysa sayaç yalnızca bu sayfada çalışır */
  }
}

const clock = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Öğrencinin çalışma sayacı: Başlat / Duraklat / Bitir. Sayfadan çıkılsa da süre kaldığı yerden devam eder
 * (cihazda saklanır); "Bitir ve kaydet" dakikayı kaydeder.
 */
export function StudyTimer({ studentId, today, subjects }: { studentId: string; today: string; subjects: string[] }) {
  const key = `pikoc-sayac-${studentId}`;
  const [timer, setTimer] = useState<Timer>(EMPTY);
  const [now, setNow] = useState(0);
  const minutesRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Cihazdaki sayaç yalnızca istemcide okunur
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimer(readTimer(key));
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [key]);
  const update = (t: Timer) => {
    setTimer(t);
    writeTimer(key, t);
  };
  const elapsed = timer.elapsed + (timer.startedAt ? Math.max(0, now - timer.startedAt) : 0);
  const running = Boolean(timer.startedAt);
  const started = running || timer.elapsed > 0;
  return (
    <ActionForm
      action={portalAddStudyAction}
      className="space-y-3"
      onSubmit={() => {
        // Gönderilmeden önce süre dakikaya çevrilir; sayaç sıfırlanır
        const minutes = Math.max(1, Math.round(elapsed / 60000));
        if (minutesRef.current) minutesRef.current.value = String(minutes);
        update(EMPTY);
      }}
    >
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="date" value={today} />
      <input ref={minutesRef} type="hidden" name="minutes" defaultValue="0" />
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900 px-5 py-4 text-white">
        <span className="font-display text-4xl font-extrabold tabular-nums" aria-live="polite">
          {clock(elapsed)}
        </span>
        <div className="flex gap-2">
          {running ? (
            <button type="button" onClick={() => update({ ...timer, startedAt: null, elapsed })} className="inline-flex size-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Duraklat">
              <Pause className="size-5" aria-hidden />
            </button>
          ) : (
            <button type="button" onClick={() => update({ ...timer, startedAt: Date.now() })} className="inline-flex size-11 items-center justify-center rounded-full bg-brand-600 hover:bg-brand-700" aria-label={started ? "Devam et" : "Başlat"}>
              <Play className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <Field label="Ders (isteğe bağlı)">
        <Input name="subject" list={`sayac-ders-${studentId}`} maxLength={60} value={timer.subject} onChange={(e) => update({ ...timer, subject: e.target.value })} placeholder="Matematik" />
        <datalist id={`sayac-ders-${studentId}`}>
          {subjects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton disabled={elapsed < 30_000} pendingText="Kaydediliyor…">
          <Square className="size-4" aria-hidden /> Bitir ve kaydet
        </SubmitButton>
        {started ? (
          <button type="button" onClick={() => update(EMPTY)} className="text-sm font-medium text-slate-500 hover:text-rose-600">
            Sıfırla
          </button>
        ) : (
          <span className="text-xs text-slate-500">Çalışmaya başlarken başlat; ara verince duraklat.</span>
        )}
      </div>
    </ActionForm>
  );
}

/** Elle çalışma süresi girişi (koç ya da öğrenci). */
export function StudyEntryForm({ studentId, today, subjects, portal = false }: { studentId: string; today: string; subjects: string[]; portal?: boolean }) {
  return (
    <ActionForm action={portal ? portalAddStudyAction : kocAddStudyAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Gün">
          <DateInput name="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Ders (isteğe bağlı)">
          <Input name="subject" list={`calisma-ders-${studentId}`} maxLength={60} placeholder="Matematik" />
          <datalist id={`calisma-ders-${studentId}`}>
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Süre (dakika)">
          <Input name="minutes" type="number" inputMode="numeric" min={1} max={720} required placeholder="90" />
          <FieldError name="minutes" />
        </Field>
      </div>
      <SubmitButton size="sm" variant="outline">
        Ekle
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteStudyButton({ sessionId, portal = false }: { sessionId: string; portal?: boolean }) {
  return (
    <ActionForm action={portal ? portalDeleteStudyAction : kocDeleteStudyAction} hideMessages>
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Kayıt silinsin mi?" aria-label="Sil">
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

/** Tahsilat satırı: ödendi işaretle (tutar ve yöntemle) ya da geri al. */
export function PaymentControls({ studentId, period, fee, payment }: { studentId: string; period: string; fee: string; payment: { id: string } | null }) {
  if (payment) {
    return (
      <ActionForm action={kocDeletePaymentAction} hideMessages>
        <input type="hidden" name="paymentId" value={payment.id} />
        <SubmitButton size="sm" variant="ghost" className="h-8 text-slate-500 hover:text-rose-600" pendingText="…" confirmMessage="Ödeme kaydı geri alınsın mı?">
          Geri al
        </SubmitButton>
      </ActionForm>
    );
  }
  return (
    <ActionForm action={kocRecordPaymentAction} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="period" value={period} />
      <Input name="amount" inputMode="decimal" defaultValue={fee} required className="h-8 w-24 text-right text-sm" aria-label="Tutar (TL)" placeholder="TL" />
      <Select name="method" defaultValue="Havale" className="h-8 w-28 text-xs" aria-label="Ödeme yöntemi">
        <option>Havale</option>
        <option>Nakit</option>
        <option>Kart</option>
      </Select>
      <SubmitButton size="sm" className="h-8 px-3 text-xs" pendingText="…">
        Ödendi
      </SubmitButton>
    </ActionForm>
  );
}

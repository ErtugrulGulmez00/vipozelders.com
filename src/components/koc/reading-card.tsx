"use client";

import { BookOpen, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  addReadingBookAction,
  deleteReadingBookAction,
  portalAddReadingBookAction,
  portalDeleteReadingBookAction,
  portalUpdateReadingBookAction,
  updateReadingBookAction,
} from "@/actions/koc-reading";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { ReadingBook } from "@/server/koc-reading";

const dmy = (d: string) => d.split("-").reverse().join(".");

/** Kitap okuma takibi: okunan kitaplar, sayfa ilerlemesi ve bitenler. mode="portal": öğrencinin kendi ekranı. */
export function ReadingCard({
  studentId,
  books,
  summary,
  mode,
  canWrite = true,
}: {
  studentId: string;
  books: ReadingBook[];
  summary: { finished: number; finishedThisMonth: number; pagesLast30: number };
  mode: "coach" | "portal";
  canWrite?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const portal = mode === "portal";
  const reading = books.filter((b) => !b.finishedOn);
  const finished = books.filter((b) => b.finishedOn);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Okunan kitap", value: summary.finished },
          { label: "Bu ay biten", value: summary.finishedThisMonth },
          { label: "Son 30 gün sayfa", value: summary.pagesLast30 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-slate-50 px-2 py-3">
            <p className="font-display text-2xl font-extrabold text-ink-900">{s.value.toLocaleString("tr-TR")}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {reading.length ? (
        <ul className="space-y-3">
          {reading.map((b) => {
            const rate = b.totalPages ? Math.min(1, b.pagesRead / b.totalPages) : null;
            return (
              <li key={b.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <BookOpen className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-900">{b.title}</p>
                    <p className="text-xs text-slate-500">
                      {[b.author, b.startedOn ? `başladı ${dmy(b.startedOn)}` : null, b.addedByStudent && !portal ? "öğrenci ekledi" : null].filter(Boolean).join(" · ")}
                    </p>
                    {rate !== null ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${rate * 100}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-slate-600">
                          {b.pagesRead}/{b.totalPages}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                {canWrite ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <ActionForm action={portal ? portalUpdateReadingBookAction : updateReadingBookAction} className="flex items-end gap-2">
                      <input type="hidden" name="studentId" value={studentId} />
                      <input type="hidden" name="bookId" value={b.id} />
                      <label className="text-xs text-slate-600">
                        Okunan sayfa
                        <Input name="pagesRead" type="number" min={0} max={b.totalPages ?? undefined} defaultValue={b.pagesRead} className="mt-1 h-9 w-24" />
                      </label>
                      <SubmitButton size="sm" variant="outline" pendingText="…">
                        Kaydet
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={portal ? portalUpdateReadingBookAction : updateReadingBookAction}>
                      <input type="hidden" name="studentId" value={studentId} />
                      <input type="hidden" name="bookId" value={b.id} />
                      <input type="hidden" name="pagesRead" value={b.totalPages ?? b.pagesRead} />
                      <input type="hidden" name="finished" value="1" />
                      <SubmitButton size="sm" variant="secondary" pendingText="…">
                        <Check className="size-4" aria-hidden /> Bitirdi{portal ? "m" : ""}
                      </SubmitButton>
                    </ActionForm>
                    {!portal || b.addedByStudent ? (
                      <ActionForm action={portal ? portalDeleteReadingBookAction : deleteReadingBookAction} className="ml-auto">
                        <input type="hidden" name="studentId" value={studentId} />
                        <input type="hidden" name="bookId" value={b.id} />
                        <SubmitButton size="sm" variant="ghost" className="text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Kitap silinsin mi?" aria-label="Kitabı sil">
                          <Trash2 className="size-4" aria-hidden />
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{portal ? "Şu an okuduğun bir kitap yok. Başladığın kitabı ekle; koçun da görsün." : "Şu an okunan kitap yok."}</p>
      )}

      {finished.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bitenler</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {finished.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-medium text-slate-800">{b.title}</b>
                  {b.author ? <span className="text-slate-500"> · {b.author}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {b.totalPages ? `${b.totalPages} sf · ` : ""}
                  {dmy(b.finishedOn!)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canWrite ? (
        adding ? (
          <ActionForm action={portal ? portalAddReadingBookAction : addReadingBookAction} resetOnSuccess className={cn("space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3")}>
            <input type="hidden" name="studentId" value={studentId} />
            <Field label="Kitabın adı" htmlFor="reading-title">
              <Input id="reading-title" name="title" required maxLength={160} />
            </Field>
            <FieldError name="title" />
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Yazarı (isteğe bağlı)" htmlFor="reading-author">
                <Input id="reading-author" name="author" maxLength={120} />
              </Field>
              <Field label="Sayfa sayısı (isteğe bağlı)" htmlFor="reading-pages">
                <Input id="reading-pages" name="totalPages" type="number" min={1} max={5000} />
              </Field>
            </div>
            <FieldError name="totalPages" />
            <div className="flex gap-2">
              <SubmitButton size="sm" pendingText="Ekleniyor…">
                Kitabı ekle
              </SubmitButton>
              <button type="button" onClick={() => setAdding(false)} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
                Vazgeç
              </button>
            </div>
          </ActionForm>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-brand-700 hover:underline">
            + Kitap ekle
          </button>
        )
      ) : null}
    </div>
  );
}

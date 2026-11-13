"use client";

import { Check, Copy, Loader2, MessageSquareText, ListChecks, Route, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { studentAssistantAction } from "@/actions/assistant";
import { cn } from "@/lib/cn";

type Kind = "comment" | "summary" | "roadmap";

const KINDS: { kind: Kind; label: string; text: string; Icon: typeof Sparkles }[] = [
  { kind: "comment", label: "Haftalık yorum", text: "Bu hafta ne iyi gitti, neye dikkat etmeli, görüşmede ne sorulmalı", Icon: MessageSquareText },
  { kind: "summary", label: "Özet", text: "Haftanın sayılarla kısa özeti", Icon: ListChecks },
  { kind: "roadmap", label: "Yol haritası", text: "Önümüzdeki 3-4 hafta için somut öneriler", Icon: Route },
];

/** Öğrenci sayfasında yapay zekâ asistanı: öğretmen isterse kullanır; metin kaydedilmez, veliye gitmez. */
export function StudentAssistant({ studentId, aiEnabled, freeLeft }: { studentId: string; aiEnabled: boolean; freeLeft: number | null }) {
  const [active, setActive] = useState<Kind | null>(null);
  const [result, setResult] = useState<{ text: string; info: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(kind: Kind) {
    setActive(kind);
    setCopied(false);
    startTransition(async () => {
      const r = await studentAssistantAction(studentId, kind);
      if (!r.ok) return setResult({ text: "", info: r.error });
      setResult({ text: r.text, info: r.notice ?? (r.source === "ai" ? "Yapay zekâ önerisi: verilerden üretildi, karar sizin." : "Verilerden kurallı öneri (yapay zekâ kapalı).") });
    });
  }

  return (
    <section className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink-900">
            <Sparkles className="size-5 text-violet-600" aria-hidden /> Yapay zekâ asistanı
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Öğrencinin bu haftasına ve son haftalarına bakıp size yardımcı not yazar. Yalnızca siz görürsünüz; kaydedilmez, veliye gitmez. Yapay zekâya öğrencinin adı gitmez, yalnızca sayılar gider.
          </p>
        </div>
        {freeLeft !== null ? <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Bu ay kalan hak: {freeLeft}</span> : null}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {KINDS.map(({ kind, label, text, Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => run(kind)}
            disabled={pending}
            className={cn("flex items-start gap-3 rounded-2xl border bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-sm disabled:opacity-60", active === kind ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-200")}
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              {pending && active === kind ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
            </span>
            <span>
              <span className="block font-bold text-ink-900">{label}</span>
              <span className="block text-xs text-slate-500">{text}</span>
            </span>
          </button>
        ))}
      </div>
      {pending ? <p className="mt-4 text-sm text-slate-500">{aiEnabled ? "Hazırlanıyor… (yapay zekâ 10-30 saniye sürebilir)" : "Hazırlanıyor…"}</p> : null}
      {result && !pending ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" data-testid="assistant-result">
          {result.text ? <p className="whitespace-pre-line text-sm leading-relaxed text-ink-900">{result.text}</p> : null}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {result.info ? <p className="text-xs text-slate-500">{result.info}</p> : <span />}
            {result.text ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(result.text).then(() => setCopied(true));
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
              >
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Kopyalandı" : "Kopyala"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

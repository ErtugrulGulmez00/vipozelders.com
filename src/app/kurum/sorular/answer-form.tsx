"use client";

import { useState } from "react";
import { answerQuestionAction } from "@/actions/center/questions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Field, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export function AnswerForm({ questionId, answered }: { questionId: string; answered: boolean }) {
  const [mode, setMode] = useState<"answer" | "in_person">("answer");
  return (
    <ActionForm action={answerQuestionAction} className="space-y-4">
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="mode" value={mode} />
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: "answer" as const, label: "Çözüm ekle", hint: "Yazı, fotoğraf ya da video" },
          { value: "in_person" as const, label: "Yüz yüze anlatacağım", hint: "Derste / etütte" },
        ].map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setMode(o.value)}
            aria-pressed={mode === o.value}
            className={cn("rounded-xl border p-3 text-left", mode === o.value ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:bg-slate-50")}
          >
            <span className="block text-sm font-semibold text-slate-900">{o.label}</span>
            <span className="block text-xs text-slate-500">{o.hint}</span>
          </button>
        ))}
      </div>
      <Field label={mode === "answer" ? "Açıklama" : "Öğrenciye not (isteğe bağlı)"}>
        <Textarea name="text" rows={3} placeholder={mode === "answer" ? "Çözüm adımları, ipucu…" : "Örn: Perşembe etüdünde birlikte çözeceğiz."} />
      </Field>
      {mode === "answer" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Çözüm fotoğrafı" hint="JPG, PNG, WEBP · en fazla 8 MB">
            <FileInput name="image" accept="image/*" placeholder="Fotoğraf seçin ya da çekin" />
          </Field>
          <Field label="Çözüm videosu" hint="MP4, MOV, WEBM · en fazla 25 MB">
            <FileInput name="video" accept="video/mp4,video/quicktime,video/webm,video/*" placeholder="Video seçin ya da çekin" />
          </Field>
        </div>
      ) : null}
      <SubmitButton pendingText="Gönderiliyor…">{answered ? "Cevabı güncelle" : mode === "answer" ? "Çözümü gönder" : "Öğrenciye bildir"}</SubmitButton>
    </ActionForm>
  );
}

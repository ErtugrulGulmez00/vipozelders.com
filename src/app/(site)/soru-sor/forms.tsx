"use client";

import Link from "next/link";
import { useState } from "react";
import { askPoolQuestionAction, buyCreditsAction } from "@/actions/question-pool";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";

type Package = { credits: number; price: number; unit: number; saving: number };

/** Kredi paketi seçimi ve ödeme. */
export function BuyCreditsForm({ packages, disabled }: { packages: Package[]; disabled: boolean }) {
  const [selected, setSelected] = useState(packages.find((p) => p.credits === 10)?.credits ?? packages[0]?.credits);
  return (
    <ActionForm action={buyCreditsAction} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {packages.map((p) => (
          <label
            key={p.credits}
            className={cn(
              "relative flex cursor-pointer flex-col rounded-2xl border bg-white p-4 transition",
              selected === p.credits ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200 hover:border-brand-300",
            )}
          >
            <input type="radio" name="credits" value={p.credits} checked={selected === p.credits} onChange={() => setSelected(p.credits)} className="sr-only" />
            {p.saving > 0 ? <span className="absolute right-3 top-3 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">%{p.saving} avantajlı</span> : null}
            <span className="text-sm font-medium text-slate-500">{p.credits === 1 ? "Tek soru" : `${p.credits} soru`}</span>
            <span className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(p.price)}</span>
            <span className="mt-1 text-xs text-slate-500">Soru başı {formatMoney(p.unit)}</span>
          </label>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <Checkbox
          name="consent"
          required
          label={
            <>
              <Link href="/sayfa/on-bilgilendirme-formu" target="_blank" className="font-medium text-brand-700 underline">
                Ön Bilgilendirme Formu
              </Link>{" "}
              ile{" "}
              <Link href="/sayfa/mesafeli-satis-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
                Mesafeli Satış Sözleşmesi
              </Link>
              ’ni okudum ve onaylıyorum.
            </>
          }
        />
        <FieldError name="consent" />
      </div>
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Ödeme sayfası hazırlanıyor…" disabled={disabled}>
        Ödemeye geç
      </SubmitButton>
    </ActionForm>
  );
}

/** Soru gönderme: kademe/ders, fotoğraf ve not. 1 kredi düşer. */
export function AskQuestionForm({ subjects, balance }: { subjects: { value: string; levelName: string; subjectName: string }[]; balance: number }) {
  const levels = [...new Set(subjects.map((s) => s.levelName))];
  return (
    <ActionForm action={askPoolQuestionAction} className="space-y-5">
      <Field label="Kademe ve ders" htmlFor="pair">
        <Select id="pair" name="pair" required defaultValue="">
          <option value="" disabled>
            Seçin
          </option>
          {levels.map((level) => (
            <optgroup key={level} label={level}>
              {subjects
                .filter((s) => s.levelName === level)
                .map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.levelName} · {s.subjectName}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <FieldError name="pair" />
      </Field>
      <Field label="Sorunun fotoğrafı" hint="Tek bir soru gönderin; şıklarıyla birlikte net ve tam görünsün. Birden fazla soru ya da okunmayan fotoğraf geri çevrilir (kredi iade edilir).">
        <FileInput name="image" accept="image/*" capture="environment" placeholder="Fotoğraf çek / seç" required />
        <FieldError name="image" />
      </Field>
      <Field label="Not (isteğe bağlı)" htmlFor="note" hint="Nerede takıldığınızı yazarsanız çözüm ona göre anlatılır. Telefon, e-posta gibi iletişim bilgileri gizlenir.">
        <Textarea id="note" name="note" rows={3} maxLength={1000} placeholder="Örn: İkinci adımdan sonra nasıl devam edeceğimi bulamadım." />
      </Field>
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Soru yükleniyor…">
        Soruyu gönder (1 kredi · kalan {balance})
      </SubmitButton>
    </ActionForm>
  );
}

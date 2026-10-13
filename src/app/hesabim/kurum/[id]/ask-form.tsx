"use client";

import { askQuestionAction, withdrawQuestionAction } from "@/actions/center-public";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Field, Input, Select } from "@/components/ui/form";

export function AskQuestionForm({ guardianId, subjects }: { guardianId: string; subjects: string[] }) {
  return (
    <ActionForm action={askQuestionAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="guardianId" value={guardianId} />
      <Field label="Sorunun fotoğrafı" hint="Telefonda kamerayı açar; soruyu net ve tam çekin.">
        <FileInput name="image" accept="image/*" capture="environment" placeholder="Fotoğraf çek / seç" required />
        <FieldError name="image" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ders">
          <Select name="subject" defaultValue="" required>
            <option value="" disabled>
              Seçin
            </option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <FieldError name="subject" />
        </Field>
        <Field label="Not (isteğe bağlı)">
          <Input name="note" maxLength={500} placeholder="Örn: B şıkkını neden eledik?" />
        </Field>
      </div>
      <SubmitButton pendingText="Gönderiliyor…">Soruyu gönder</SubmitButton>
    </ActionForm>
  );
}

export function WithdrawQuestionButton({ questionId }: { questionId: string }) {
  return (
    <ActionForm action={withdrawQuestionAction} hideMessages>
      <input type="hidden" name="questionId" value={questionId} />
      <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" pendingText="…" confirmMessage="Soru geri çekilsin mi?">
        Geri çek
      </SubmitButton>
    </ActionForm>
  );
}

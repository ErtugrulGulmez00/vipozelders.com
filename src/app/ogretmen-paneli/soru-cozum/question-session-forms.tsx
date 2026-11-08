"use client";

import { openQuestionSessionAction, saveQuestionSessionOfferAction } from "@/actions/lesson-links";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input } from "@/components/ui/form";

export function QuestionSessionOfferForm({ enabled }: { enabled: boolean }) {
  return (
    <ActionForm action={saveQuestionSessionOfferAction} className="space-y-4">
      <Checkbox name="offersQuestionSession" defaultChecked={enabled} label="Benden ders alan öğrenciye 30 dakika soru çözümü de sağlıyorum" />
      <SubmitButton>Kaydet</SubmitButton>
    </ActionForm>
  );
}

export function OpenQuestionSessionForm({ bookingId, today }: { bookingId: string; today: string }) {
  return (
    <ActionForm action={openQuestionSessionAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Field label="Gün">
        <Input type="date" name="date" min={today} defaultValue={today} required />
      </Field>
      <Field label="Saat">
        <Input type="time" name="time" step={300} required />
      </Field>
      <SubmitButton pendingText="Açılıyor…">Dersi aç</SubmitButton>
    </ActionForm>
  );
}

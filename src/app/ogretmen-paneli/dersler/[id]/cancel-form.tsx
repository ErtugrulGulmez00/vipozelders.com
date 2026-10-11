"use client";

import { teacherCancelAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Textarea } from "@/components/ui/form";

export function TeacherCancelForm({ bookingId }: { bookingId: string }) {
  return (
    <ActionForm action={teacherCancelAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm text-slate-600">İptal ettiğinizde öğrenciye ücretin tamamı iade edilir ve iptal sayınız artar; sık iptal sıralamanızı düşürür.</p>
      <Field label="Öğrenciye iletilecek gerekçe">
        <Textarea name="reason" rows={2} required maxLength={300} />
      </Field>
      <SubmitButton variant="danger" confirmMessage="Dersi iptal etmek istediğinize emin misiniz?" pendingText="İptal ediliyor…">
        Dersi iptal et
      </SubmitButton>
    </ActionForm>
  );
}

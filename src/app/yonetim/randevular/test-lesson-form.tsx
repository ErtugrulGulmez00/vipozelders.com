"use client";

import { Video } from "lucide-react";
import { createTestLessonAction } from "@/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";

export function TestLessonForm({ teachers, students }: { teachers: { id: string; name: string }[]; students: { email: string; name: string }[] }) {
  return (
    <details className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-brand-800 [&::-webkit-details-marker]:hidden">
        <Video className="size-4" aria-hidden /> Test dersi oluştur (görüntülü görüşme ve beyaz tahta denemesi)
      </summary>
      <p className="mt-2 text-sm text-slate-600">Ödeme almadan, seçtiğiniz öğretmen ile öğrenci arasında onaylı bir online ders açar. Puan, yorum ve ciroya sayılmaz.</p>
      <ActionForm action={createTestLessonAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Öğretmen">
          <Select name="teacherId" required>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğrenci/veli e-postası">
          <Input name="studentEmail" type="email" list="test-students" required />
          <datalist id="test-students">
            {students.map((s) => (
              <option key={s.email} value={s.email}>
                {s.name}
              </option>
            ))}
          </datalist>
          <FieldError name="studentEmail" />
        </Field>
        <Field label="Başlangıç (boşsa 2 dk sonra)">
          <Input name="startAt" type="datetime-local" />
        </Field>
        <Field label="Süre">
          <Select name="duration" defaultValue="60">
            <option value="30">30 dk</option>
            <option value="45">45 dk</option>
            <option value="60">60 dk</option>
            <option value="90">90 dk</option>
          </Select>
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <SubmitButton pendingText="Oluşturuluyor…">Test dersini oluştur</SubmitButton>
        </div>
      </ActionForm>
    </details>
  );
}

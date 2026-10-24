"use client";

import { updateLessonRequestAction } from "@/actions/lesson-requests";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Input, Select } from "@/components/ui/form";

export function LessonRequestStatusForm({ id, status, note }: { id: string; status: string; note: string }) {
  return (
    <ActionForm action={updateLessonRequestAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Select name="status" defaultValue={status} className="w-auto">
        <option value="NEW">Yeni</option>
        <option value="CONTACTED">Arandı</option>
        <option value="MATCHED">Öğretmenle eşleşti</option>
        <option value="CLOSED">Kapandı</option>
      </Select>
      <Input name="adminNote" defaultValue={note} placeholder="Not (yalnızca yönetim görür)" className="min-w-48 flex-1" />
      <SubmitButton size="sm" variant="outline" pendingText="Kaydediliyor…">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

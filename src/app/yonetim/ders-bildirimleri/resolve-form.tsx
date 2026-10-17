"use client";

import { resolveClassroomReportAction } from "@/actions/classroom";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Textarea } from "@/components/ui/form";

export function ResolveReportForm({ id, teacherSuspended }: { id: string; teacherSuspended: boolean }) {
  return (
    <ActionForm action={resolveClassroomReportAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Field label="İnceleme notu">
        <Textarea name="note" rows={3} maxLength={1000} required placeholder="Kimlerle görüşüldü, ne karar verildi?" />
      </Field>
      <div className="flex flex-wrap gap-2">
        {teacherSuspended ? (
          <SubmitButton name="decision" value="restore" size="sm" variant="outline" pendingText="…" confirmMessage="Öğretmen yeniden yayına alınsın mı?">
            Öğretmeni yayına al
          </SubmitButton>
        ) : null}
        <SubmitButton name="decision" value="keep" size="sm" pendingText="…">
          {teacherSuspended ? "Askıda bırak, kapat" : "Bildirimi kapat"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

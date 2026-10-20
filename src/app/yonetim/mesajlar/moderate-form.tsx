"use client";

import { moderateThreadAction } from "@/actions/admin-messages";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

export function ModerateThreadForm({ threadId, teacherSuspended }: { threadId: string; teacherSuspended: boolean }) {
  return (
    <ActionForm action={moderateThreadAction} className="space-y-3">
      <input type="hidden" name="threadId" value={threadId} />
      <Field label="Not (isteğe bağlı, öğretmene gider)">
        <Input name="note" maxLength={500} placeholder="Örn: Veliden telefon numarası istemişsiniz." />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="reviewed" size="sm" variant="outline" pendingText="…">
          Sorun yok, incelendi
        </SubmitButton>
        <SubmitButton name="decision" value="warn" size="sm" variant="secondary" pendingText="…">
          Öğretmeni uyar
        </SubmitButton>
        {teacherSuspended ? null : (
          <SubmitButton name="decision" value="suspend" size="sm" variant="danger" pendingText="…" confirmMessage="Öğretmenin profili yayından kaldırılacak ve randevu alamayacak. Onaylıyor musunuz?">
            Öğretmeni askıya al
          </SubmitButton>
        )}
      </div>
    </ActionForm>
  );
}

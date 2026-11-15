"use client";

import { resolveReportAction } from "@/actions/safety";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function ResolveReportButton({ id }: { id: string }) {
  return (
    <ActionForm action={resolveReportAction} className="ml-auto">
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="outline" pendingText="Kapatılıyor…">
        İncelendi, kapat
      </SubmitButton>
    </ActionForm>
  );
}

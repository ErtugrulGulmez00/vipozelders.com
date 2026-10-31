"use client";

import { claimLessonLinkAction } from "@/actions/lesson-links";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function ClaimLinkForm({ token }: { token: string }) {
  return (
    <ActionForm action={claimLessonLinkAction}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="lg" className="w-full" pendingText="Kaydediliyor…">
        Derse kaydol
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import { acceptGuardianInviteAction } from "@/actions/center-public";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function AcceptInviteForm({ token }: { token: string }) {
  return (
    <ActionForm action={acceptGuardianInviteAction}>
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="lg" className="w-full" pendingText="Bağlanıyor…">
        Hesabıma bağla
      </SubmitButton>
    </ActionForm>
  );
}

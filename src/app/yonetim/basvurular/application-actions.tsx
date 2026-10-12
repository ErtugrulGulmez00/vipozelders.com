"use client";

import { useEffect, useState } from "react";
import { approveApplicationAction, rejectApplicationAction } from "@/actions/applications";
import { ActionForm, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { Input } from "@/components/ui/form";
import { Credentials } from "../ogretmenler/yeni/new-teacher-form";

/** Hesap açılınca sayfa yenilenmez: giriş bilgileri kopyalanana kadar ekranda kalır, düğmeler kalkar. */
function ApprovedWatcher({ onApproved }: { onApproved: () => void }) {
  const state = useActionResult();
  useEffect(() => {
    if (state.ok) onApproved();
  }, [state.ok, onApproved]);
  return null;
}

export function ApplicationDecision({ applicationId }: { applicationId: string }) {
  const [approved, setApproved] = useState(false);
  const [onApproved] = useState(() => () => setApproved(true));
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <ActionForm action={approveApplicationAction} hideMessages={false} className="min-w-0 flex-1">
        <ApprovedWatcher onApproved={onApproved} />
        <Credentials />
        <input type="hidden" name="applicationId" value={applicationId} />
        {approved ? null : (
          <SubmitButton size="sm" pendingText="Hesap açılıyor…" confirmMessage="Bu başvuru için öğretmen hesabı açılsın mı? Giriş bilgileri adaya e-postayla da gönderilir.">
            Onayla ve hesap aç
          </SubmitButton>
        )}
      </ActionForm>
      {approved ? null : (
        <ActionForm action={rejectApplicationAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="applicationId" value={applicationId} />
          <Input name="note" placeholder="İç not (adaya gönderilmez)" className="h-8 w-56" />
          <SubmitButton size="sm" variant="outline" pendingText="…" confirmMessage="Başvuru reddedilsin mi? Adaya kibar bir bilgilendirme e-postası gider.">
            Reddet
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

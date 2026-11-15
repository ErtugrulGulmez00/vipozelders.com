"use client";

import { mergeAccountAction } from "@/actions/account-merge";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input } from "@/components/ui/form";

/** Çift hesap: bu hesabı öğrencinin asıl hesabına katar (kurum/Pi Koç bağlantıları taşınır, bu hesap kapanır). */
export function MergeAccountForm({ userId }: { userId: string }) {
  return (
    <ActionForm action={mergeAccountAction} className="space-y-3">
      <input type="hidden" name="sourceId" value={userId} />
      <p className="text-sm text-slate-600">
        Öğrencinin iki hesabı varsa (ör. özel dersten kendi açtığı ve koçun açtığı), fazla olanın sayfasından asıl hesabın e-postasını ya da kullanıcı adını yazın. Pi Koç ve kurum bağlantıları ile bildirimler asıl hesaba taşınır, bu hesap kapatılır.
      </p>
      <Field label="Asıl hesabın e-postası ya da kullanıcı adı" htmlFor="merge-target">
        <Input id="merge-target" name="target" required maxLength={120} />
      </Field>
      <FieldError name="target" />
      <SubmitButton size="sm" variant="outline" pendingText="Birleştiriliyor…" confirmMessage="Bu hesap asıl hesaba katılıp kapatılsın mı?">
        Asıl hesaba katıp bu hesabı kapat
      </SubmitButton>
    </ActionForm>
  );
}

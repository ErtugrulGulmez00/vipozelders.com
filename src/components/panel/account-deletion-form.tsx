"use client";

import { requestAccountDeletionAction } from "@/actions/auth";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Textarea } from "@/components/ui/form";

/** Hesap silme talebi: yönetim açık ders ve ödemeleri kontrol edip hesabı en geç 30 gün içinde siler. */
export function AccountDeletionForm() {
  return (
    <ActionForm action={requestAccountDeletionAction} className="space-y-3">
      <p className="text-sm text-slate-600">
        Hesabınızın ve kişisel verilerinizin silinmesini isteyebilirsiniz. Yaklaşan dersleriniz varsa önce iptal edilmeleri gerekir; yasal saklama süresi olan fatura ve ödeme kayıtları anonimleştirilerek saklanır.
      </p>
      <Field label="Gerekçe (isteğe bağlı)" htmlFor="delete-reason">
        <Textarea id="delete-reason" name="reason" rows={2} maxLength={500} />
      </Field>
      <div>
        <Checkbox name="confirm" label="Hesabımın silinmesini istiyorum; bu işlemin geri alınamayacağını biliyorum." />
        <FieldError name="confirm" />
      </div>
      <SubmitButton variant="danger" size="sm" pendingText="Gönderiliyor…">
        Silme talebi gönder
      </SubmitButton>
    </ActionForm>
  );
}

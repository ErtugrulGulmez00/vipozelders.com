"use client";

import { respondInquiryAction } from "@/actions/teacher-inquiries";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

/** Öğretmen: ders talebini kabul et / geri çevir. */
export function InquiryActions({ inquiryId }: { inquiryId: string }) {
  return (
    <ActionForm action={respondInquiryAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <SubmitButton size="sm" name="accept" value="1" pendingText="Kaydediliyor…">
        Kabul et
      </SubmitButton>
      <SubmitButton size="sm" variant="outline" name="accept" value="0" confirmMessage="Talep geri çevrilsin mi? Veliye nazik bir bildirim gider.">
        Geri çevir
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import { adminCancelBookingAction, resolveDisputeAction, retryRefundAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Textarea } from "@/components/ui/form";

export function AdminCancelForm({ bookingId, maxRefund, suggested }: { bookingId: string; maxRefund: string; suggested: string }) {
  return (
    <ActionForm action={adminCancelBookingAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Field label="İade tutarı (₺)" hint={`En fazla ${maxRefund} ₺. Onay bekleyen taleplerde her zaman tam iade yapılır.`}>
        <Input name="refundAmount" inputMode="decimal" defaultValue={suggested} />
      </Field>
      <Field label="Gerekçe (öğrenci ve öğretmene iletilir)">
        <Textarea name="reason" rows={2} required />
      </Field>
      <SubmitButton variant="danger" confirmMessage="Randevu iptal edilsin mi?" pendingText="İptal ediliyor…">
        Randevuyu iptal et
      </SubmitButton>
    </ActionForm>
  );
}

export function ResolveDisputeForm({ bookingId, maxRefund }: { bookingId: string; maxRefund: string }) {
  return (
    <ActionForm action={resolveDisputeAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Field label="Öğrenciye iade (₺)" hint={`0 = ücretin tamamı öğretmene · ${maxRefund} = tam iade. Kalan tutar komisyon oranında bölünür.`}>
        <Input name="refundAmount" inputMode="decimal" defaultValue="0" />
      </Field>
      <Field label="Karar notu (iki tarafa iletilir)">
        <Textarea name="note" rows={2} required />
      </Field>
      <SubmitButton pendingText="Kaydediliyor…">İtirazı sonuçlandır</SubmitButton>
    </ActionForm>
  );
}

export function RetryRefundButton({ refundId }: { refundId: string }) {
  return (
    <ActionForm action={retryRefundAction}>
      <input type="hidden" name="refundId" value={refundId} />
      <SubmitButton size="sm" variant="outline" pendingText="…">
        Tekrar dene
      </SubmitButton>
    </ActionForm>
  );
}

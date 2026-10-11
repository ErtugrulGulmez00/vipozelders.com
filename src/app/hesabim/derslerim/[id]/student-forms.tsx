"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { cancelBookingAction, disputeAction, reviewAction } from "@/actions/student";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export function CancelForm({ bookingId, refundText }: { bookingId: string; refundText: string }) {
  return (
    <ActionForm action={cancelBookingAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <p className="text-sm text-slate-600">{refundText}</p>
      <Field label="İptal gerekçesi" htmlFor="cancel-reason">
        <Textarea id="cancel-reason" name="reason" rows={2} required maxLength={300} placeholder="Örn: Okul programı değişti." />
      </Field>
      <FieldError name="reason" />
      <SubmitButton variant="danger" confirmMessage="Randevuyu iptal etmek istediğinize emin misiniz?" pendingText="İptal ediliyor…">
        Randevuyu iptal et
      </SubmitButton>
    </ActionForm>
  );
}

export function DisputeForm({ bookingId }: { bookingId: string }) {
  return (
    <ActionForm action={disputeAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Field label="Ne oldu?" htmlFor="dispute-reason" hint="Ekibimiz inceler; inceleme bitene kadar öğretmene ödeme yapılmaz.">
        <Textarea id="dispute-reason" name="reason" rows={3} required maxLength={1000} placeholder="Örn: Ders 20 dakika geç başladı / bağlantı kurulamadı." />
      </Field>
      <FieldError name="reason" />
      <SubmitButton variant="outline" pendingText="Gönderiliyor…">
        Sorun bildir
      </SubmitButton>
    </ActionForm>
  );
}

export function ReviewForm({ teacherId, initialRating, initialComment }: { teacherId: string; initialRating?: number; initialComment?: string | null }) {
  const [rating, setRating] = useState(initialRating ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <ActionForm action={reviewAction} className="space-y-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" aria-label={`${value} yıldız`} onClick={() => setRating(value)} onMouseEnter={() => setHover(value)} className="p-0.5">
            <Star className={cn("size-7", (hover || rating) >= value ? "fill-gold-400 text-gold-400" : "fill-slate-200 text-slate-200")} aria-hidden />
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-500">{rating ? `${rating}/5` : "Puan seçin"}</span>
      </div>
      <Field label="Yorumunuz (isteğe bağlı)" htmlFor="review-comment" hint="Yorumunuz adınızın baş harfiyle birlikte öğretmenin profilinde yayınlanır.">
        <Textarea id="review-comment" name="comment" rows={3} maxLength={1500} defaultValue={initialComment ?? ""} placeholder="Ders nasıl geçti? Öğretmenin anlatımı, iletişimi, dakikliği…" />
      </Field>
      <SubmitButton disabled={!rating} pendingText="Kaydediliyor…">
        {initialRating ? "Değerlendirmeyi güncelle" : "Değerlendirmeyi gönder"}
      </SubmitButton>
    </ActionForm>
  );
}

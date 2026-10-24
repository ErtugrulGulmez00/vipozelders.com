"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { adminEndSubscriptionAction, askSubscriptionQuestionAction, saveQuestionPlanAction, subscribeAction } from "@/actions/subscriptions";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { CardLogos } from "@/components/site/card-logos";
import { CouponField } from "@/components/forms/coupon-field";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

export type PlanFormValues = { pair: string; label: string; priceTl: number; dailyLimit: number; answerHours: number; description: string; isActive: boolean };

/** Öğretmen: bir kademe + ders için abonelik planı (yeni ya da mevcut). */
export function PlanForm({ pairs, values, limits }: { pairs?: { value: string; label: string }[]; values?: PlanFormValues; limits: { minTl: number; maxTl: number } }) {
  return (
    <ActionForm action={saveQuestionPlanAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess={!values}>
      {values ? (
        <input type="hidden" name="pair" value={values.pair} />
      ) : (
        <Field label="Kademe ve ders" htmlFor="pair" className="sm:col-span-2">
          <Select id="pair" name="pair" required defaultValue="">
            <option value="" disabled>
              Seçin
            </option>
            {pairs?.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <FieldError name="pair" />
        </Field>
      )}
      <Field label="30 günlük ücret (₺, KDV dahil)" hint={`${limits.minTl.toLocaleString("tr-TR")} – ${limits.maxTl.toLocaleString("tr-TR")} ₺`}>
        <Input name="priceTl" inputMode="numeric" required defaultValue={values?.priceTl ?? 1000} />
      </Field>
      <Field label="Günde en fazla soru" hint="Sizi boğmayacak bir sınır seçin.">
        <Input name="dailyLimit" type="number" min={1} max={50} required defaultValue={values?.dailyLimit ?? 10} />
      </Field>
      <Field label="Soru başına cevap süresi (saat)" hint="Bu sürede cevaplanmayan soru “kaçırılmış” sayılır.">
        <Input name="answerHours" type="number" min={1} max={48} required defaultValue={values?.answerHours ?? 12} />
      </Field>
      <Field label="Kısa açıklama (isteğe bağlı)" className="sm:col-span-2">
        <Textarea name="description" rows={2} maxLength={500} defaultValue={values?.description ?? ""} placeholder="Örn: LGS matematik sorularınızı adım adım, videolu çözüyorum." />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
        <Checkbox name="isActive" defaultChecked={values?.isActive ?? true} label="Satışta (profilimde görünsün)" />
        <SubmitButton pendingText="Kaydediliyor…">{values ? "Kaydet" : "Planı oluştur"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Veli: sözleşme onayı ve ödemeye geçiş. */
export function SubscribeForm({ planId, label }: { planId: string; label: string }) {
  return (
    <ActionForm action={subscribeAction} className="space-y-4">
      <input type="hidden" name="planId" value={planId} />
      <CouponField target="subscription" refId={planId} />
      <div className="rounded-xl border border-slate-200 p-4">
        <Checkbox
          name="consent"
          required
          label={
            <>
              <Link href="/sayfa/on-bilgilendirme-formu" target="_blank" className="font-medium text-brand-700 underline">
                Ön Bilgilendirme Formu
              </Link>{" "}
              ile{" "}
              <Link href="/sayfa/mesafeli-satis-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
                Mesafeli Satış Sözleşmesi
              </Link>
              ’ni okudum ve onaylıyorum. İptal ve iade koşulları:{" "}
              <Link href="/sayfa/iptal-ve-iade-politikasi" target="_blank" className="font-medium text-brand-700 underline">
                İptal ve İade Politikası
              </Link>
              .
            </>
          }
        />
        <FieldError name="consent" />
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Checkbox name="immediate" required label="Aboneliğin ödemeyle birlikte hemen başladığını ve bu nedenle cayma hakkımın ve iade hakkımın bulunmadığını kabul ediyorum." />
          <FieldError name="immediate" />
        </div>
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Ödeme sayfası hazırlanıyor…">
        {label}
      </SubmitButton>
      <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
        <Lock className="size-3.5" aria-hidden /> Kart bilgileriniz yalnızca bankanın 3D Secure sayfasında girilir. <CardLogos />
      </p>
    </ActionForm>
  );
}

export function SubscriptionAskForm({ subscriptionId, left }: { subscriptionId: string; left: number }) {
  return (
    <ActionForm action={askSubscriptionQuestionAction} className="space-y-5">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <Field label="Sorunun fotoğrafı" hint="Tek bir soru gönderin; şıklarıyla birlikte net ve tam görünsün.">
        <FileInput name="image" accept="image/*" capture="environment" placeholder="Fotoğraf çek / seç" required />
        <FieldError name="image" />
      </Field>
      <Field label="Not (isteğe bağlı)" htmlFor="note" hint="Nerede takıldığınızı yazarsanız çözüm ona göre anlatılır. Telefon, e-posta gibi iletişim bilgileri gizlenir.">
        <Textarea id="note" name="note" rows={3} maxLength={1000} placeholder="Örn: İkinci adımdan sonra nasıl devam edeceğimi bulamadım." />
      </Field>
      <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Soru yükleniyor…" disabled={left <= 0}>
        Soruyu gönder (bugün kalan {left})
      </SubmitButton>
    </ActionForm>
  );
}

export function AdminEndSubscriptionForm({ id }: { id: string }) {
  return (
    <ActionForm action={adminEndSubscriptionAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <Field label="Gerekçe" className="min-w-48 flex-1">
        <Input name="reason" required placeholder="Örn: Öğretmen hesabı kapandı" />
        <FieldError name="reason" />
      </Field>
      <SubmitButton variant="danger" size="sm" pendingText="Sonlandırılıyor…" confirmMessage="Abonelik hemen bitsin, kalan günlerin ücreti iade edilsin mi?">
        Sonlandır (kalan günler iade)
      </SubmitButton>
    </ActionForm>
  );
}

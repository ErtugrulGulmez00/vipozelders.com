"use client";

import { useState } from "react";
import {
  answerFollowUpAction,
  answerPoolQuestionAction,
  askFollowUpAction,
  cancelPoolQuestionAction,
  claimPoolQuestionAction,
  disputePoolAnswerAction,
  ratePoolAnswerAction,
  refundCreditsAction,
  rejectPoolQuestionAction,
  releasePoolClaimAction,
  resolvePoolDisputeAction,
  setAnswersPoolAction,
} from "@/actions/question-pool";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

// ---------------------------------------------------------------------------
// Öğrenci
// ---------------------------------------------------------------------------

export function CancelQuestionForm({ id }: { id: string }) {
  return (
    <ActionForm action={cancelPoolQuestionAction}>
      <Id id={id} />
      <SubmitButton variant="outline" size="sm" pendingText="Geri çekiliyor…" confirmMessage="Soru geri çekilsin ve krediniz iade edilsin mi?">
        Soruyu geri çek
      </SubmitButton>
    </ActionForm>
  );
}

export function FollowUpForm({ id }: { id: string }) {
  return (
    <ActionForm action={askFollowUpAction} className="space-y-3">
      <Id id={id} />
      <Field label="Anlamadığınız yeri sorun (bir kez)">
        <Textarea name="body" rows={3} maxLength={1000} required placeholder="Örn: 3. adımda neden 2 ile çarptık?" />
      </Field>
      <SubmitButton size="sm" pendingText="Gönderiliyor…">
        Ek soruyu gönder
      </SubmitButton>
    </ActionForm>
  );
}

export function RatingForm({ id, current }: { id: string; current: number | null }) {
  const [value, setValue] = useState(current ?? 0);
  return (
    <ActionForm action={ratePoolAnswerAction} className="flex flex-wrap items-center gap-3">
      <Id id={id} />
      <input type="hidden" name="rating" value={value} />
      <div className="flex gap-1" role="radiogroup" aria-label="Çözümü puanlayın">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} puan`}
            onClick={() => setValue(n)}
            className={cn("size-9 rounded-lg text-lg leading-none ring-1 transition", n <= value ? "bg-gold-400 text-brand-950 ring-gold-400" : "bg-white text-slate-300 ring-slate-200 hover:ring-gold-300")}
          >
            ★
          </button>
        ))}
      </div>
      <SubmitButton size="sm" variant="secondary" disabled={!value} pendingText="Kaydediliyor…">
        {current ? "Puanı güncelle" : "Puanla"}
      </SubmitButton>
    </ActionForm>
  );
}

export function DisputeForm({ id }: { id: string }) {
  return (
    <ActionForm action={disputePoolAnswerAction} className="space-y-3">
      <Id id={id} />
      <Field label="Çözümde ne yanlış ya da eksik?" hint="Ekibimiz inceler; haklı bulunursa krediniz iade edilir.">
        <Textarea name="reason" rows={3} maxLength={1000} required minLength={10} />
      </Field>
      <SubmitButton size="sm" variant="outline" pendingText="Gönderiliyor…">
        Sorun bildir
      </SubmitButton>
    </ActionForm>
  );
}

export function RefundCreditsForm({ id, label }: { id: string; label: string }) {
  return (
    <ActionForm action={refundCreditsAction}>
      <Id id={id} />
      <SubmitButton size="sm" variant="outline" pendingText="İade başlatılıyor…" confirmMessage="Kullanılmayan krediler silinip ücret kartınıza iade edilsin mi?">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Öğretmen
// ---------------------------------------------------------------------------

export function ClaimForm({ id, size = "md" }: { id: string; size?: "sm" | "md" }) {
  return (
    <ActionForm action={claimPoolQuestionAction}>
      <Id id={id} />
      <SubmitButton size={size} pendingText="Üstleniliyor…">
        Üstlen ve çöz
      </SubmitButton>
    </ActionForm>
  );
}

export function ReleaseClaimForm({ id }: { id: string }) {
  return (
    <ActionForm action={releasePoolClaimAction}>
      <Id id={id} />
      <SubmitButton variant="ghost" size="sm" pendingText="Bırakılıyor…" confirmMessage="Soru havuza geri bırakılsın mı?">
        Havuza geri bırak
      </SubmitButton>
    </ActionForm>
  );
}

export function AnswerForm({ id }: { id: string }) {
  return (
    <ActionForm action={answerPoolQuestionAction} className="space-y-3">
      <Id id={id} />
      <Field label="Çözüm" hint="Adım adım açıklayın; yalnızca şık yazmak yeterli değil. Telefon, e-posta ve sosyal medya bilgileri otomatik gizlenir.">
        <Textarea name="body" rows={7} maxLength={5000} required minLength={20} placeholder="1) Verilenleri yazalım… 2) …" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Çözüm fotoğrafı (isteğe bağlı)">
          <FileInput name="image" accept="image/*" capture="environment" placeholder="Fotoğraf çek / seç" />
        </Field>
        <Field label="Anlatım videosu (isteğe bağlı)" hint="En fazla 25 MB.">
          <FileInput name="video" accept="video/*" capture="environment" placeholder="Video çek / seç" />
        </Field>
      </div>
      <SubmitButton pendingText="Gönderiliyor…">Çözümü gönder</SubmitButton>
    </ActionForm>
  );
}

export function RejectForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-rose-700 hover:underline">
        Soru çözülebilir değil (tek soru değil / okunmuyor)
      </button>
    );
  }
  return (
    <ActionForm action={rejectPoolQuestionAction} className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
      <Id id={id} />
      <Field label="Neden?" hint="Öğrencinin kredisi iade edilir; bu sorudan ödeme almazsınız.">
        <Input name="reason" maxLength={300} required placeholder="Örn: Fotoğrafta birden fazla soru var." />
      </Field>
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger" pendingText="Gönderiliyor…">
          Geri çevir
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-600 hover:underline">
          Vazgeç
        </button>
      </div>
    </ActionForm>
  );
}

export function FollowUpAnswerForm({ id }: { id: string }) {
  return (
    <ActionForm action={answerFollowUpAction} className="space-y-3">
      <Id id={id} />
      <Field label="Ek soruya cevabınız">
        <Textarea name="body" rows={4} maxLength={3000} required />
      </Field>
      <SubmitButton size="sm" pendingText="Gönderiliyor…">
        Cevabı gönder
      </SubmitButton>
    </ActionForm>
  );
}

export function AnswersPoolToggle({ on }: { on: boolean }) {
  return (
    <ActionForm action={setAnswersPoolAction} className="flex flex-wrap items-center gap-3">
      <Checkbox name="answersPool" defaultChecked={on} label="Ders verdiğim kademe ve derslerde soru havuzuna katılıyorum (yeni soru bildirimleri gelir)" />
      <SubmitButton size="sm" variant="secondary">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

// ---------------------------------------------------------------------------
// Yönetici
// ---------------------------------------------------------------------------

export function ResolvePoolDisputeForm({ id }: { id: string }) {
  return (
    <ActionForm action={resolvePoolDisputeAction} className="space-y-3">
      <Id id={id} />
      <Field label="Karar notu (öğrenciye ve öğretmene gider)">
        <Textarea name="note" rows={2} maxLength={500} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="upheld" size="sm" variant="danger" pendingText="Kaydediliyor…" confirmMessage="İtiraz haklı: öğrenciye kredi iade edilecek, öğretmene ödeme yapılmayacak. Onaylıyor musunuz?">
          İtiraz haklı (kredi iade)
        </SubmitButton>
        <SubmitButton name="decision" value="rejected" size="sm" variant="outline" pendingText="Kaydediliyor…">
          Çözüm yeterli
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

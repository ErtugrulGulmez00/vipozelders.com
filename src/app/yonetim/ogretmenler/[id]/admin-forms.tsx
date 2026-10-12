"use client";

import { KeyRound } from "lucide-react";
import {
  recordPayoutAction,
  resetPasswordAction,
  reviewDocumentAction,
  setTeacherFlagsAction,
  setTeacherStatusAction,
  setUserStatusAction,
  updateTeacherAccountAction,
} from "@/actions/admin";
import { ActionForm, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

export function AccountForm({ user }: { user: { id: string; firstName: string; lastName: string; email: string | null; username: string | null; phone: string | null } }) {
  return (
    <ActionForm action={updateTeacherAccountAction} className="space-y-3">
      <input type="hidden" name="userId" value={user.id} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad">
          <Input name="firstName" defaultValue={user.firstName} required />
        </Field>
        <Field label="Soyad">
          <Input name="lastName" defaultValue={user.lastName} required />
        </Field>
      </div>
      <Field label="Kullanıcı adı">
        <Input name="username" defaultValue={user.username ?? ""} />
      </Field>
      <Field label="E-posta">
        <Input name="email" type="email" defaultValue={user.email ?? ""} />
      </Field>
      <Field label="Telefon">
        <Input name="phone" defaultValue={user.phone ?? ""} />
      </Field>
      <SubmitButton variant="outline">Hesabı kaydet</SubmitButton>
    </ActionForm>
  );
}

export function StatusButtons({ teacherId, status }: { teacherId: string; status: string }) {
  const options = [
    { value: "PUBLISHED", label: "Yayına al", variant: "primary" as const },
    { value: "DRAFT", label: "Taslağa al", variant: "outline" as const },
    { value: "SUSPENDED", label: "Askıya al", variant: "danger" as const },
  ].filter((o) => o.value !== status);
  // Tek form: durum değişince düğmeler değişse de sonuç mesajı ekranda kalır.
  return (
    <ActionForm action={setTeacherStatusAction}>
      <input type="hidden" name="teacherId" value={teacherId} />
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <SubmitButton
            key={o.value}
            name="status"
            value={o.value}
            variant={o.variant}
            size="sm"
            pendingText="…"
            confirmMessage={o.value === "SUSPENDED" ? "Öğretmen askıya alınsın mı? Yeni randevu alamaz." : undefined}
          >
            {o.label}
          </SubmitButton>
        ))}
      </div>
    </ActionForm>
  );
}

export function FlagsForm({ teacherId, verificationStatus, isFeatured, commissionPercent, defaultPercent }: { teacherId: string; verificationStatus: string; isFeatured: boolean; commissionPercent: string; defaultPercent: string }) {
  return (
    <ActionForm action={setTeacherFlagsAction} className="space-y-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      <Field label="Doğrulama durumu" hint="Kimlik ve diploma kontrol edildiyse “Onaylı öğretmen” rozeti görünür.">
        <Select name="verificationStatus" defaultValue={verificationStatus}>
          <option value="UNVERIFIED">Doğrulanmadı</option>
          <option value="PENDING">İncelemede</option>
          <option value="VERIFIED">Onaylı öğretmen</option>
          <option value="REJECTED">Reddedildi</option>
        </Select>
      </Field>
      <Field label="Öğretmene özel komisyon (%)" hint={`Boş bırakılırsa site varsayılanı (%${defaultPercent}) uygulanır.`}>
        <Input name="commissionPercent" inputMode="decimal" defaultValue={commissionPercent} placeholder={defaultPercent} className="w-32" />
      </Field>
      <Checkbox name="isFeatured" defaultChecked={isFeatured} label="Vitrinde öne çıkar (listelerde üstte, “Öne çıkan” rozeti)" />
      <SubmitButton variant="outline">Kaydet</SubmitButton>
    </ActionForm>
  );
}

function NewPassword() {
  const state = useActionResult();
  const password = state.ok ? (state.data?.password as string | undefined) : undefined;
  if (!password) return null;
  return (
    <p className="mt-2 rounded-lg bg-emerald-50 p-3 font-mono text-sm">
      Yeni geçici şifre: <strong>{password}</strong>
    </p>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  return (
    <ActionForm action={resetPasswordAction} hideMessages>
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton variant="outline" size="sm" confirmMessage="Yeni geçici şifre üretilsin mi? Mevcut oturumları kapanır." pendingText="…">
        <KeyRound className="size-4" aria-hidden /> Geçici şifre üret
      </SubmitButton>
      <NewPassword />
    </ActionForm>
  );
}

export function UserStatusForm({ userId, status }: { userId: string; status: string }) {
  const next = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  return (
    <ActionForm action={setUserStatusAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton variant={next === "SUSPENDED" ? "danger" : "primary"} size="sm" confirmMessage={next === "SUSPENDED" ? "Hesap kapatılsın mı? Kullanıcı giriş yapamaz." : undefined} pendingText="…">
        {next === "SUSPENDED" ? "Hesabı kapat" : "Hesabı aç"}
      </SubmitButton>
    </ActionForm>
  );
}

export function PayoutRecordForm({ teacherId, available }: { teacherId: string; available: string }) {
  return (
    <ActionForm action={recordPayoutAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tutar (₺)">
          <Input name="amount" inputMode="decimal" defaultValue={available} required />
        </Field>
        <Field label="Havale açıklaması">
          <Input name="reference" placeholder="Dekont no / tarih" required />
        </Field>
      </div>
      <SubmitButton variant="secondary">Ödemeyi kaydet</SubmitButton>
    </ActionForm>
  );
}

/** Belge incelemesi: onay veya gerekçeli ret (gerekçe öğretmene iletilir). */
export function DocumentReviewForm({ documentId }: { documentId: string }) {
  return (
    <ActionForm action={reviewDocumentAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="documentId" value={documentId} />
      <Field label="Not (ret için zorunlu)" className="min-w-48 flex-1">
        <Input name="note" placeholder="Örn: Belge okunmuyor, lütfen yeniden yükleyin" />
      </Field>
      <SubmitButton name="decision" value="APPROVED" size="sm" pendingText="…">
        Onayla
      </SubmitButton>
      <SubmitButton name="decision" value="REJECTED" variant="outline" size="sm" pendingText="…">
        Reddet
      </SubmitButton>
    </ActionForm>
  );
}

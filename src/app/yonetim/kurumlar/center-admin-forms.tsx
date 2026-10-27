"use client";

import Link from "next/link";
import { addCenterOwnerAction, createCenterAction, recordSubscriptionPaymentAction, setCenterApplicationStatusAction, updateCenterAdminAction } from "@/actions/center-admin";
import { CredentialsBox } from "@/components/center/center-client";
import { ActionForm, FieldError, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { CENTER_EDITION_LABEL, CENTER_KIND_LABEL, CENTER_PLAN_LABEL, CENTER_STATUS } from "@/lib/center/labels";

export type CenterPrefill = {
  applicationId?: string;
  name?: string;
  kind?: string;
  edition?: string;
  cityId?: number | null;
  phone?: string;
  email?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
};

function CreatedLink() {
  const state = useActionResult();
  const centerId = state.ok ? (state.data?.centerId as string | undefined) : undefined;
  if (!centerId) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {state.data?.linkedExisting ? <p className="text-sm text-emerald-800">E-postası kayıtlı hesap kurum sahibi olarak eklendi; mevcut şifresiyle giriş yapabilir.</p> : null}
      <Link href={`/yonetim/kurumlar/${centerId}`} className={buttonClasses("primary", "sm")}>
        Kurum sayfasına git
      </Link>
    </div>
  );
}

export function CreateCenterForm({ cities, trialDays, prefill = {} }: { cities: { id: number; name: string }[]; trialDays: number; prefill?: CenterPrefill }) {
  return (
    <ActionForm action={createCenterAction} resetOnSuccess className="space-y-4">
      <CredentialsBox who="Kurum yetkilisi" />
      <CreatedLink />
      {prefill.applicationId ? <input type="hidden" name="applicationId" value={prefill.applicationId} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kurum adı" className="sm:col-span-2">
          <Input name="name" defaultValue={prefill.name} required />
          <FieldError name="name" />
        </Field>
        <Field label="Tür">
          <Select name="kind" defaultValue={prefill.kind ?? "ETUT"}>
            {Object.entries(CENTER_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="İl">
          <Select name="cityId" defaultValue={prefill.cityId ? String(prefill.cityId) : ""}>
            <option value="">Seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paket">
          <Select name="edition" defaultValue={prefill.edition ?? (prefill.kind === "ETUT" ? "ETUT" : "DERSHANE")}>
            {Object.entries(CENTER_EDITION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğrenci kademesi">
          <Select name="plan" defaultValue="STARTER">
            {Object.entries(CENTER_PLAN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ücretsiz deneme (gün)">
          <Input name="trialDays" type="number" min={1} max={90} defaultValue={trialDays} />
        </Field>
        <Field label="Kurum telefonu">
          <Input name="phone" defaultValue={prefill.phone} />
        </Field>
        <Field label="Kurum e-postası">
          <Input name="centerEmail" type="email" defaultValue={prefill.email} />
          <FieldError name="centerEmail" />
        </Field>
      </div>
      <p className="pt-2 text-sm font-semibold text-slate-800">Kurum sahibi (panele giriş yapacak yetkili)</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad">
          <Input name="ownerFirstName" defaultValue={prefill.ownerFirstName} required />
          <FieldError name="ownerFirstName" />
        </Field>
        <Field label="Soyad">
          <Input name="ownerLastName" defaultValue={prefill.ownerLastName} required />
          <FieldError name="ownerLastName" />
        </Field>
        <Field label="E-posta" hint="Şifre belirleme bağlantısı gönderilir.">
          <Input name="ownerEmail" type="email" defaultValue={prefill.email} required />
          <FieldError name="ownerEmail" />
        </Field>
        <Field label="Cep telefonu">
          <Input name="ownerPhone" type="tel" defaultValue={prefill.phone} placeholder="05XX XXX XX XX" />
          <FieldError name="ownerPhone" />
        </Field>
      </div>
      <SubmitButton>Kurumu aç</SubmitButton>
    </ActionForm>
  );
}

const toInputDate = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function CenterAdminForm({ center }: { center: { id: string; name: string; kind: string; edition: string; plan: string; status: string; studentLimit: number; trialEndsAt: string | null; paidUntil: string | null } }) {
  return (
    <ActionForm action={updateCenterAdminAction} className="space-y-3">
      <input type="hidden" name="centerId" value={center.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kurum adı" className="sm:col-span-2">
          <Input name="name" defaultValue={center.name} required />
        </Field>
        <Field label="Tür">
          <Select name="kind" defaultValue={center.kind}>
            {Object.entries(CENTER_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Durum">
          <Select name="status" defaultValue={center.status}>
            {Object.entries(CENTER_STATUS).map(([value, s]) => (
              <option key={value} value={value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Paket">
          <Select name="edition" defaultValue={center.edition}>
            {Object.entries(CENTER_EDITION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğrenci kademesi">
          <Select name="plan" defaultValue={center.plan}>
            {Object.entries(CENTER_PLAN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Öğrenci sınırı">
          <Input name="studentLimit" type="number" min={1} defaultValue={center.studentLimit} />
        </Field>
        <Field label="Deneme bitişi">
          <Input name="trialEndsAt" type="date" defaultValue={toInputDate(center.trialEndsAt)} />
        </Field>
        <Field label="Abonelik bitişi">
          <Input name="paidUntil" type="date" defaultValue={toInputDate(center.paidUntil)} />
        </Field>
      </div>
      <SubmitButton size="sm">Kaydet</SubmitButton>
    </ActionForm>
  );
}

export function SubscriptionPaymentForm({ centerId, plan, monthlyPrice }: { centerId: string; plan: string; monthlyPrice: number | null }) {
  return (
    <ActionForm action={recordSubscriptionPaymentAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="centerId" value={centerId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tutar (TL)">
          <Input name="amount" inputMode="decimal" defaultValue={monthlyPrice ? String(monthlyPrice) : ""} required />
          <FieldError name="amount" />
        </Field>
        <Field label="Süre (ay)">
          <Input name="months" type="number" min={1} max={36} defaultValue={1} />
        </Field>
        <Field label="Ödeme şekli">
          <Select name="method" defaultValue="Havale/EFT">
            <option>Havale/EFT</option>
            <option>Kredi kartı</option>
            <option>Nakit</option>
          </Select>
        </Field>
        <Field label="Öğrenci kademesi">
          <Select name="plan" defaultValue={plan}>
            {Object.entries(CENTER_PLAN_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Dekont / açıklama" className="sm:col-span-2">
          <Input name="reference" placeholder="Dekont no, banka" />
        </Field>
      </div>
      <SubmitButton size="sm">Ödemeyi kaydet ve süreyi uzat</SubmitButton>
    </ActionForm>
  );
}

export function AddOwnerForm({ centerId }: { centerId: string }) {
  return (
    <ActionForm action={addCenterOwnerAction} resetOnSuccess className="space-y-3">
      <CredentialsBox who="Kurum yetkilisi" />
      <input type="hidden" name="centerId" value={centerId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad">
          <Input name="firstName" required />
        </Field>
        <Field label="Soyad">
          <Input name="lastName" required />
        </Field>
        <Field label="E-posta">
          <Input name="email" type="email" required />
          <FieldError name="email" />
        </Field>
        <Field label="Cep telefonu">
          <Input name="phone" type="tel" />
          <FieldError name="phone" />
        </Field>
      </div>
      <SubmitButton size="sm" variant="outline">
        Kurum sahibi ekle
      </SubmitButton>
    </ActionForm>
  );
}

export function ApplicationStatusForm({ applicationId, status }: { applicationId: string; status: string }) {
  return (
    <ActionForm action={setCenterApplicationStatusAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="status" value={status === "REJECTED" ? "NEW" : "REJECTED"} />
      {status !== "REJECTED" ? <Input name="note" placeholder="İç not" className="h-8 w-48" /> : null}
      <SubmitButton size="sm" variant="ghost" pendingText="…" confirmMessage={status === "REJECTED" ? undefined : "Başvuru kapatılsın mı?"}>
        {status === "REJECTED" ? "Yeniden aç" : "Kapat"}
      </SubmitButton>
    </ActionForm>
  );
}

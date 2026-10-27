"use client";

import { useState } from "react";
import { addStaffAction, resetStaffPasswordAction, updateStaffAction } from "@/actions/center/organization";
import { CredentialsBox } from "@/components/center/center-client";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { CENTER_ROLE_HINT, CENTER_ROLE_LABEL, type CenterRoleName } from "@/lib/center/permissions";

function RoleSelect({ defaultValue, allowOwner }: { defaultValue: CenterRoleName; allowOwner: boolean }) {
  const roles = (Object.keys(CENTER_ROLE_LABEL) as CenterRoleName[]).filter((r) => allowOwner || r !== "OWNER");
  return (
    <Select name="role" defaultValue={defaultValue}>
      {roles.map((r) => (
        <option key={r} value={r}>
          {CENTER_ROLE_LABEL[r]} — {CENTER_ROLE_HINT[r]}
        </option>
      ))}
    </Select>
  );
}

export function AddStaffForm({ allowOwner }: { allowOwner: boolean }) {
  return (
    <ActionForm action={addStaffAction} resetOnSuccess className="space-y-3">
      <CredentialsBox />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ad">
          <Input name="firstName" required />
          <FieldError name="firstName" />
        </Field>
        <Field label="Soyad">
          <Input name="lastName" required />
          <FieldError name="lastName" />
        </Field>
        <Field label="E-posta" hint="Sitede hesabı (özel ders öğretmeni, veli) varsa aynı hesap kuruma eklenir.">
          <Input name="email" type="email" required />
          <FieldError name="email" />
        </Field>
        <Field label="Cep telefonu">
          <Input name="phone" type="tel" placeholder="05XX XXX XX XX" />
          <FieldError name="phone" />
        </Field>
        <Field label="Rol" className="sm:col-span-2">
          <RoleSelect defaultValue="TEACHER" allowOwner={allowOwner} />
        </Field>
        <Field label="Görev">
          <Input name="title" placeholder="Örn: Rehber öğretmen" />
        </Field>
        <Field label="Branş">
          <Input name="branch" placeholder="Örn: Matematik" />
        </Field>
      </div>
      <SubmitButton size="sm">Personeli ekle</SubmitButton>
    </ActionForm>
  );
}

export function StaffRow({ member, allowOwner, canReset, isSelf }: { member: { id: string; role: CenterRoleName; title: string | null; branch: string | null; isActive: boolean }; allowOwner: boolean; canReset: boolean; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const editable = allowOwner || member.role !== "OWNER";
  if (!editable) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-brand-700 hover:underline">
        {open ? "Kapat" : "Düzenle"}
      </button>
      {open ? (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-3">
          <ActionForm action={updateStaffAction} className="space-y-3">
            <input type="hidden" name="memberId" value={member.id} />
            <Field label="Rol">
              <RoleSelect defaultValue={member.role} allowOwner={allowOwner} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Görev">
                <Input name="title" defaultValue={member.title ?? ""} />
              </Field>
              <Field label="Branş">
                <Input name="branch" defaultValue={member.branch ?? ""} />
              </Field>
            </div>
            <Checkbox name="isActive" defaultChecked={member.isActive} disabled={isSelf} label="Aktif (pasif personel panele giremez)" />
            {isSelf ? <input type="hidden" name="isActive" value="on" /> : null}
            <SubmitButton size="sm">Kaydet</SubmitButton>
          </ActionForm>
          {canReset ? (
            <ActionForm action={resetStaffPasswordAction} className="border-t border-slate-100 pt-3">
              <CredentialsBox />
              <input type="hidden" name="memberId" value={member.id} />
              <SubmitButton size="sm" variant="outline" confirmMessage="Yeni geçici şifre oluşturulsun mu? Kişinin açık oturumları kapanır.">
                Şifreyi sıfırla
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

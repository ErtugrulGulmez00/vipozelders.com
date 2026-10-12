"use client";

import { createLeadAction, deleteLeadAction, updateLeadAction } from "@/actions/center/communication";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { GRADE_OPTIONS, LEAD_STATUS } from "@/lib/center/labels";

export function LeadForm() {
  return (
    <ActionForm action={createLeadAction} resetOnSuccess className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Öğrenci adı soyadı">
          <Input name="studentName" required />
          <FieldError name="studentName" />
        </Field>
        <Field label="Veli">
          <Input name="parentName" />
        </Field>
        <Field label="Telefon">
          <Input name="phone" type="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
        <Field label="Sınıf">
          <Select name="gradeName" defaultValue="">
            <option value="">Seçin</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nereden geldi">
          <Select name="source" defaultValue="telefon">
            <option value="telefon">Telefon</option>
            <option value="ziyaret">Kurum ziyareti</option>
            <option value="tavsiye">Tavsiye</option>
            <option value="sosyal-medya">Sosyal medya</option>
            <option value="diger">Diğer</option>
          </Select>
        </Field>
        <Field label="E-posta">
          <Input name="email" type="email" />
          <FieldError name="email" />
        </Field>
        <Field label="Not" className="sm:col-span-2">
          <Textarea name="message" rows={2} />
        </Field>
      </div>
      <SubmitButton size="sm">Adayı kaydet</SubmitButton>
    </ActionForm>
  );
}

export function LeadStatusForm({ leadId, status, note }: { leadId: string; status: string; note: string | null }) {
  return (
    <ActionForm action={updateLeadAction} hideMessages className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <Select name="status" defaultValue={status} className="h-8 w-32" aria-label="Durum">
        {Object.entries(LEAD_STATUS).map(([value, s]) => (
          <option key={value} value={value}>
            {s.label}
          </option>
        ))}
      </Select>
      <Input name="note" defaultValue={note ?? ""} placeholder="Görüşme notu" className="h-8 w-48" />
      <SubmitButton size="sm" variant="outline" pendingText="…">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  return (
    <ActionForm action={deleteLeadAction} hideMessages>
      <input type="hidden" name="leadId" value={leadId} />
      <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" pendingText="…" confirmMessage="Aday silinsin mi?">
        Sil
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import { createStudentAction, updateStudentAction } from "@/actions/center/students";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { GRADE_OPTIONS, GUARDIAN_RELATIONS, TARGET_EXAMS } from "@/lib/center/labels";

export type StudentFormValues = {
  id?: string;
  studentNumber?: string | null;
  firstName?: string;
  lastName?: string;
  gender?: string;
  birthDate?: string | null;
  identityMasked?: string | null;
  schoolName?: string | null;
  gradeName?: string | null;
  targetExam?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  groupIds?: string[];
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function GuardianFields({ prefix, title, required }: { prefix: string; title: string; required?: boolean }) {
  return (
    <Section title={title} description={required ? "Devamsızlık, ödeme ve deneme bildirimleri veliye gider." : "İsteğe bağlı"}>
      <input type="hidden" name={`${prefix}Prefs`} value="1" />
      <Field label="Ad soyad" htmlFor={`${prefix}FullName`}>
        <Input id={`${prefix}FullName`} name={`${prefix}FullName`} autoComplete="off" />
        <FieldError name={`${prefix}FullName`} />
      </Field>
      <Field label="Yakınlık" htmlFor={`${prefix}Relation`}>
        <Select id={`${prefix}Relation`} name={`${prefix}Relation`} defaultValue={prefix === "guardian1" ? "Anne" : "Baba"}>
          {GUARDIAN_RELATIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      <Field label="Cep telefonu" htmlFor={`${prefix}Phone`}>
        <Input id={`${prefix}Phone`} name={`${prefix}Phone`} type="tel" placeholder="05XX XXX XX XX" />
        <FieldError name={`${prefix}Phone`} />
      </Field>
      <Field label="E-posta" htmlFor={`${prefix}Email`}>
        <Input id={`${prefix}Email`} name={`${prefix}Email`} type="email" />
        <FieldError name={`${prefix}Email`} />
      </Field>
      <div className="flex flex-col justify-end gap-2 sm:col-span-2">
        <Checkbox name={`${prefix}NotifySms`} defaultChecked label="SMS bildirimleri gönderilsin" />
        <Checkbox name={`${prefix}NotifyEmail`} defaultChecked label="E-posta bildirimleri gönderilsin" />
      </div>
    </Section>
  );
}

export function StudentForm({
  values = {},
  groups,
  leadId,
  mode,
}: {
  values?: StudentFormValues;
  groups: { id: string; name: string }[];
  leadId?: string | null;
  mode: "create" | "edit";
}) {
  return (
    <ActionForm action={mode === "create" ? createStudentAction : updateStudentAction} className="space-y-6">
      {values.id ? <input type="hidden" name="studentId" value={values.id} /> : null}
      {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
      <Section title="Öğrenci bilgileri">
        <Field label="Ad" htmlFor="firstName">
          <Input id="firstName" name="firstName" defaultValue={values.firstName} required autoComplete="off" />
          <FieldError name="firstName" />
        </Field>
        <Field label="Soyad" htmlFor="lastName">
          <Input id="lastName" name="lastName" defaultValue={values.lastName} required autoComplete="off" />
          <FieldError name="lastName" />
        </Field>
        <Field label="Öğrenci no" htmlFor="studentNumber" hint={mode === "create" ? "Boş bırakırsanız otomatik verilir." : undefined}>
          <Input id="studentNumber" name="studentNumber" defaultValue={values.studentNumber ?? ""} required={mode === "edit"} />
          <FieldError name="studentNumber" />
        </Field>
        <Field label="Sınıf" htmlFor="gradeName">
          <Select id="gradeName" name="gradeName" defaultValue={values.gradeName ?? ""}>
            <option value="">Seçin</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hedef" htmlFor="targetExam">
          <Select id="targetExam" name="targetExam" defaultValue={values.targetExam ?? ""}>
            <option value="">Seçin</option>
            {TARGET_EXAMS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Okulu" htmlFor="schoolName">
          <Input id="schoolName" name="schoolName" defaultValue={values.schoolName ?? ""} />
        </Field>
        <Field label="Cinsiyet" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={values.gender ?? "UNSPECIFIED"}>
            <option value="UNSPECIFIED">Belirtilmedi</option>
            <option value="FEMALE">Kız</option>
            <option value="MALE">Erkek</option>
          </Select>
        </Field>
        <Field label="Doğum tarihi" htmlFor="birthDate">
          <Input id="birthDate" name="birthDate" type="date" defaultValue={values.birthDate ?? ""} />
          <FieldError name="birthDate" />
        </Field>
        <Field label="T.C. kimlik no" htmlFor="identityNumber" hint={values.identityMasked ? `Kayıtlı: ${values.identityMasked} (değiştirmek için yeni numara yazın)` : "Şifreli saklanır; isteğe bağlı."}>
          <Input id="identityNumber" name="identityNumber" inputMode="numeric" maxLength={11} autoComplete="off" />
          <FieldError name="identityNumber" />
          {values.identityMasked ? <Checkbox name="clearIdentity" label="Kayıtlı kimlik numarasını sil" className="mt-2" /> : null}
        </Field>
        <Field label="Öğrenci telefonu" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={values.phone ?? ""} placeholder="05XX XXX XX XX" />
          <FieldError name="phone" />
        </Field>
        <Field label="Öğrenci e-postası" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={values.email ?? ""} />
          <FieldError name="email" />
        </Field>
        <Field label="Adres" htmlFor="address" className="sm:col-span-2 lg:col-span-1">
          <Input id="address" name="address" defaultValue={values.address ?? ""} />
        </Field>
        <Field label="Notlar (yalnızca kurum içi)" htmlFor="notes" className="sm:col-span-2 lg:col-span-3">
          <Textarea id="notes" name="notes" rows={2} defaultValue={values.notes ?? ""} placeholder="Sağlık durumu, servis bilgisi, özel durumlar…" />
        </Field>
      </Section>

      {groups.length ? (
        <Section title="Sınıfları" description="Öğrenci birden fazla sınıfa/gruba katılabilir (ör. 8-A ve Matematik etüt grubu).">
          {mode === "edit" ? <input type="hidden" name="groupsField" value="1" /> : null}
          {groups.map((g) => (
            <Checkbox key={g.id} name="groupIds" value={g.id} defaultChecked={values.groupIds?.includes(g.id)} label={g.name} />
          ))}
        </Section>
      ) : null}

      {mode === "create" ? (
        <>
          <GuardianFields prefix="guardian1" title="1. veli" required />
          <GuardianFields prefix="guardian2" title="2. veli" />
        </>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton size="lg">{mode === "create" ? "Öğrenciyi kaydet" : "Değişiklikleri kaydet"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

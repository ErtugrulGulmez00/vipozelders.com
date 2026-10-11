"use client";

import { saveLevelAction, saveServiceAction, saveSubjectAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

type Level = { id: number; name: string; slug: string; group: string; sortOrder: number; isActive: boolean; grades: { name: string }[]; subjectIds: number[] };
type Subject = { id: number; name: string; slug: string; sortOrder: number; isActive: boolean };
type Service = { id: number; name: string; slug: string; description: string | null; sortOrder: number; isActive: boolean };

export function LevelForm({ level, subjects }: { level?: Level; subjects: Subject[] }) {
  return (
    <ActionForm action={saveLevelAction} resetOnSuccess={!level} className="space-y-3">
      {level ? <input type="hidden" name="id" value={level.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Ad">
          <Input name="name" defaultValue={level?.name} required />
        </Field>
        <Field label="Adres (slug)" hint="Boşsa addan üretilir">
          <Input name="slug" defaultValue={level?.slug} />
        </Field>
        <Field label="Grup">
          <Select name="group" defaultValue={level?.group ?? "SCHOOL"}>
            <option value="SCHOOL">Okul dersleri</option>
            <option value="EXAM">Sınav hazırlık</option>
            <option value="OTHER">Diğer</option>
          </Select>
        </Field>
        <Field label="Sıra">
          <Input name="sortOrder" type="number" defaultValue={level?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field label="Sınıflar (virgülle)" hint="Örn: 5. Sınıf, 6. Sınıf, 7. Sınıf">
        <Input name="grades" defaultValue={level?.grades.map((g) => g.name).join(", ")} />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Bu kademedeki dersler</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {subjects.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" name="subjectIds" value={s.id} defaultChecked={level?.subjectIds.includes(s.id)} className="accent-brand-600" />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <Checkbox name="isActive" defaultChecked={level?.isActive ?? true} label="Aktif (sitede görünsün)" />
        <SubmitButton size="sm">{level ? "Kaydet" : "Kademe ekle"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SubjectForm({ subject }: { subject?: Subject }) {
  return (
    <ActionForm action={saveSubjectAction} resetOnSuccess={!subject} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_80px_auto_auto]">
      {subject ? <input type="hidden" name="id" value={subject.id} /> : null}
      <Input name="name" defaultValue={subject?.name} placeholder="Ders adı" required aria-label="Ders adı" />
      <Input name="slug" defaultValue={subject?.slug} placeholder="slug (otomatik)" aria-label="Slug" />
      <Input name="sortOrder" type="number" defaultValue={subject?.sortOrder ?? 0} aria-label="Sıra" />
      <Checkbox name="isActive" defaultChecked={subject?.isActive ?? true} label="Aktif" />
      <SubmitButton size="sm" variant={subject ? "outline" : "primary"}>
        {subject ? "Kaydet" : "Ekle"}
      </SubmitButton>
    </ActionForm>
  );
}

export function ServiceForm({ service }: { service?: Service }) {
  return (
    <ActionForm action={saveServiceAction} resetOnSuccess={!service} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1.5fr_80px_auto_auto]">
      {service ? <input type="hidden" name="id" value={service.id} /> : null}
      <Input name="name" defaultValue={service?.name} placeholder="Hizmet adı" required aria-label="Hizmet adı" />
      <Input name="slug" defaultValue={service?.slug} placeholder="slug (otomatik)" aria-label="Slug" />
      <Input name="description" defaultValue={service?.description ?? ""} placeholder="Kısa açıklama" aria-label="Açıklama" />
      <Input name="sortOrder" type="number" defaultValue={service?.sortOrder ?? 0} aria-label="Sıra" />
      <Checkbox name="isActive" defaultChecked={service?.isActive ?? true} label="Aktif" />
      <SubmitButton size="sm" variant={service ? "outline" : "primary"}>
        {service ? "Kaydet" : "Ekle"}
      </SubmitButton>
    </ActionForm>
  );
}

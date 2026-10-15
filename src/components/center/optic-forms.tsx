"use client";

import { deleteOpticTemplateAction, importOpticAction, saveOpticTemplateAction } from "@/actions/center/exams";
import { ImportNotes } from "@/components/center/center-client";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export type OpticTemplateValues = { id: string; name: string; numberStart: number; numberLength: number; nameStart: number | null; nameLength: number | null; sections: { start: number; length: number }[] };

export function OpticImportForm({ examId, templates }: { examId: string; templates: { id: string; name: string }[] }) {
  return (
    <ActionForm action={importOpticAction} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <ImportNotes />
      <Field label="Optik şablon">
        <Select name="templateId" required defaultValue={templates[0]?.id}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Optik okuyucu dosyası" hint="Okuyucunun verdiği .txt / .dat dosyası; her satır bir form.">
        <FileInput name="file" accept=".txt,.dat,.csv,text/plain" required />
        <FieldError name="file" />
      </Field>
      <SubmitButton pendingText="Okunuyor…">Formları oku</SubmitButton>
    </ActionForm>
  );
}

/** Sabit konumlu optik çıktı şablonu: alanların satırdaki başlangıç konumu (1'den) ve uzunluğu. */
export function OpticTemplateForm({ initial, sectionNames }: { initial?: OpticTemplateValues; sectionNames: string[] }) {
  return (
    <ActionForm action={saveOpticTemplateAction} resetOnSuccess={!initial} className="space-y-3">
      {initial ? <input type="hidden" name="templateId" value={initial.id} /> : null}
      <Field label="Şablon adı">
        <Input name="name" defaultValue={initial?.name} placeholder="Örn: LGS optik formu (kurum okuyucusu)" required />
        <FieldError name="name" />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Numara başı">
          <Input name="numberStart" type="number" min={1} defaultValue={initial?.numberStart ?? 1} required />
        </Field>
        <Field label="Numara uzunluğu">
          <Input name="numberLength" type="number" min={1} defaultValue={initial?.numberLength ?? 6} required />
        </Field>
        <Field label="Ad başı (isteğe bağlı)">
          <Input name="nameStart" type="number" min={0} defaultValue={initial?.nameStart ?? ""} />
        </Field>
        <Field label="Ad uzunluğu">
          <Input name="nameLength" type="number" min={0} defaultValue={initial?.nameLength ?? ""} />
        </Field>
      </div>
      <Field label="Ders cevaplarının konumu" hint={`Sınav ders sırasıyla, “başlangıç:uzunluk”. Bu sınavın dersleri: ${sectionNames.join(", ")}`}>
        <Textarea name="sections" rows={3} defaultValue={initial?.sections.map((s) => `${s.start}:${s.length}`).join("\n")} placeholder={"30:20\n50:20\n70:10"} required />
        <FieldError name="sections" />
      </Field>
      <SubmitButton size="sm">{initial ? "Şablonu kaydet" : "Şablon ekle"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteOpticTemplateButton({ templateId }: { templateId: string }) {
  return (
    <ActionForm action={deleteOpticTemplateAction} hideMessages>
      <input type="hidden" name="templateId" value={templateId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600" pendingText="…" confirmMessage="Şablon silinsin mi?">
        Sil
      </SubmitButton>
    </ActionForm>
  );
}

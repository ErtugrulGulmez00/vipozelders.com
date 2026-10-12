"use client";

import { uploadDocumentAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Field, Select } from "@/components/ui/form";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";

export function DocumentUploadForm() {
  return (
    <ActionForm action={uploadDocumentAction} resetOnSuccess encType="multipart/form-data" className="grid gap-4 sm:grid-cols-[220px_1fr_auto] sm:items-end">
      <Field label="Belge türü" htmlFor="doc-type">
        <Select id="doc-type" name="type" defaultValue="" required>
          <option value="" disabled>
            Seçin
          </option>
          {Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Dosya (PDF, JPG veya PNG, en fazla 5 MB)" htmlFor="doc-file">
        <FileInput id="doc-file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
      </Field>
      <SubmitButton pendingText="Yükleniyor…">Yükle</SubmitButton>
    </ActionForm>
  );
}

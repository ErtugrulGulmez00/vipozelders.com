"use client";

import { useState } from "react";
import { uploadDocumentAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Field, Input, Select } from "@/components/ui/form";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";

export function DocumentUploadForm() {
  const [type, setType] = useState("");
  const criminal = type === "CRIMINAL_RECORD";
  return (
    <ActionForm action={uploadDocumentAction} resetOnSuccess encType="multipart/form-data" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr_auto] sm:items-end">
        <Field label="Belge türü" htmlFor="doc-type">
          <Select id="doc-type" name="type" value={type} onChange={(e) => setType(e.target.value)} required>
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
          <FileInput id="doc-file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" maxMb={5} required />
        </Field>
        <SubmitButton pendingText="Yükleniyor…">Yükle</SubmitButton>
      </div>
      {criminal ? (
        <div className="grid gap-4 rounded-xl bg-amber-50/60 p-4 sm:grid-cols-2">
          <p className="text-sm text-slate-700 sm:col-span-2">
            Adli sicil kaydını e-Devlet’ten (turkiye.gov.tr → Adli Sicil Kaydı) son 30 gün içinde alın. Belgenin üzerindeki barkod numarasıyla doğrulama yapılır.
          </p>
          <Field label="Belgenin alındığı tarih" htmlFor="doc-issued">
            <Input id="doc-issued" name="issuedAt" type="date" required />
          </Field>
          <Field label="e-Devlet barkod numarası" htmlFor="doc-barcode">
            <Input id="doc-barcode" name="barcode" required placeholder="Belgenin altındaki barkod / doğrulama kodu" />
          </Field>
        </div>
      ) : null}
    </ActionForm>
  );
}

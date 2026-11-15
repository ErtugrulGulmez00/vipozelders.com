"use client";

import { Trash2 } from "lucide-react";
import { deleteCenterFileAction, uploadCenterFileAction } from "@/actions/center/files";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select } from "@/components/ui/form";
import { FileInput } from "@/components/ui/file-input";

const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/** Dosya yükleme: başlık, ders, kime (herkes / sınıf / öğrenci), kısa not. */
export function CenterFileUploadForm({ groups, students }: { groups: { id: string; name: string }[]; students: { id: string; name: string }[] }) {
  return (
    <ActionForm action={uploadCenterFileAction} resetOnSuccess className="space-y-3">
      <Field label="Dosya" hint="PDF, Word, Excel, PowerPoint ya da fotoğraf · en fazla 25 MB">
        <FileInput id="center-file" name="file" accept={ACCEPT} maxMb={25} placeholder="Dosya seçin" required />
        <FieldError name="file" />
      </Field>
      <Field label="Başlık">
        <Input name="title" placeholder="Örn: Üslü sayılar çalışma kâğıdı" required maxLength={120} />
        <FieldError name="title" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ders (isteğe bağlı)">
          <Input name="subject" placeholder="Matematik" maxLength={60} />
        </Field>
        <Field label="Kimler görsün?">
          <Select name="target" defaultValue="">
            <option value="">Tüm öğrenciler</option>
            {groups.length ? (
              <optgroup label="Sınıf">
                {groups.map((g) => (
                  <option key={g.id} value={`g:${g.id}`}>
                    {g.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {students.length ? (
              <optgroup label="Tek öğrenci">
                {students.map((s) => (
                  <option key={s.id} value={`s:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>
      </div>
      <Field label="Not (isteğe bağlı)">
        <Input name="note" placeholder="Örn: Cuma'ya kadar çözüp getirin" maxLength={300} />
      </Field>
      <SubmitButton>Dosyayı ekle</SubmitButton>
    </ActionForm>
  );
}

export function DeleteCenterFileButton({ fileId, title }: { fileId: string; title: string }) {
  return (
    <ActionForm action={deleteCenterFileAction} hideMessages>
      <input type="hidden" name="fileId" value={fileId} />
      <SubmitButton size="sm" variant="ghost" className="h-8 px-2 text-rose-600" pendingText="…" confirmMessage={`“${title}” silinsin mi? Öğrenciler artık indiremez.`} aria-label={`${title} dosyasını sil`}>
        <Trash2 className="size-4" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import Link from "next/link";
import { importStudentsAction } from "@/actions/center/students";
import { ImportNotes } from "@/components/center/center-client";
import { ActionForm, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";

function AfterImport() {
  const state = useActionResult();
  return state.ok ? (
    <Link href="/kurum/ogrenciler" className="text-sm font-semibold text-brand-700 hover:underline">
      Öğrenci listesine git →
    </Link>
  ) : null;
}

export function ImportStudentsForm() {
  return (
    <ActionForm action={importStudentsAction} className="space-y-4">
      <ImportNotes />
      <FileInput name="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" required />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Aktarılıyor…">Öğrencileri aktar</SubmitButton>
        <AfterImport />
      </div>
    </ActionForm>
  );
}

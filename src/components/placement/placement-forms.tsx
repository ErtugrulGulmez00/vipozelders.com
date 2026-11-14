"use client";

import { ArrowDown, ArrowUp, Plus, Printer, Target, X } from "lucide-react";
import { deletePlacementYearAction, importPlacementAction, placementAddAction, placementChangeAction, placementNoteAction, placementTargetAction } from "@/actions/placement";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import type { PlacementExamName, PlacementInput } from "@/lib/placement";

type ListKey = { exam: PlacementExamName; studentId: string };

function Hidden({ exam, studentId, programId }: ListKey & { programId?: string }) {
  return (
    <>
      <input type="hidden" name="exam" value={exam} />
      <input type="hidden" name="studentId" value={studentId} />
      {programId ? <input type="hidden" name="programId" value={programId} /> : null}
    </>
  );
}

/** Sonuç satırında "Listeye ekle" (aramadaki puan bilgisi listeye kaydedilir) */
export function AddToListButton({ exam, studentId, programId, input, scoreType }: ListKey & { programId: string; input: PlacementInput; scoreType: string | null }) {
  return (
    <ActionForm action={placementAddAction} hideMessages>
      <Hidden exam={exam} studentId={studentId} programId={programId} />
      <input type="hidden" name="score" value={input.score ?? ""} />
      <input type="hidden" name="rank" value={input.rank ?? ""} />
      <input type="hidden" name="percentile" value={input.percentile ?? ""} />
      <input type="hidden" name="scoreType" value={scoreType ?? ""} />
      <SubmitButton size="sm" variant="secondary" pendingText="Ekleniyor…" aria-label="Tercih listesine ekle">
        <Plus className="size-4" aria-hidden /> Ekle
      </SubmitButton>
    </ActionForm>
  );
}

export function ListItemControls({ exam, studentId, programId, first, last }: ListKey & { programId: string; first: boolean; last: boolean }) {
  const btn = "inline-flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-ink-900 disabled:opacity-30";
  return (
    <ActionForm action={placementChangeAction} hideMessages className="flex shrink-0 items-center gap-0.5 print:hidden">
      <Hidden exam={exam} studentId={studentId} programId={programId} />
      <button type="submit" name="op" value="up" className={btn} disabled={first} aria-label="Yukarı taşı">
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="submit" name="op" value="down" className={btn} disabled={last} aria-label="Aşağı taşı">
        <ArrowDown className="size-4" aria-hidden />
      </button>
      <button type="submit" name="op" value="remove" className={`${btn} hover:text-rose-600`} aria-label="Listeden çıkar">
        <X className="size-4" aria-hidden />
      </button>
    </ActionForm>
  );
}

/** Listedeki tercihi öğrencinin hedefi yapar (aynı deneme türünde tek hedef) */
export function TargetButton({ exam, studentId, programId, active }: ListKey & { programId: string; active: boolean }) {
  return (
    <ActionForm action={placementTargetAction} hideMessages className="print:hidden">
      <Hidden exam={exam} studentId={studentId} programId={programId} />
      <input type="hidden" name="on" value={active ? "0" : "1"} />
      <button
        type="submit"
        className={
          active
            ? "inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-brand-700"
            : "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
        }
        aria-label={active ? "Hedefi kaldır" : "Hedef yap"}
        aria-pressed={active}
      >
        <Target className="size-3" aria-hidden /> {active ? "Hedef" : "Hedef yap"}
      </button>
    </ActionForm>
  );
}

export function PlacementNoteForm({ exam, studentId, note }: ListKey & { note: string | null }) {
  return (
    <ActionForm action={placementNoteAction} className="space-y-2 print:hidden">
      <Hidden exam={exam} studentId={studentId} />
      <Field label="Not (veli görüşmesi, öğrencinin istekleri)">
        <Textarea name="note" rows={3} maxLength={2000} defaultValue={note ?? ""} />
      </Field>
      <SubmitButton size="sm" variant="outline">
        Notu kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClasses("outline", "sm", "print:hidden")}>
      <Printer className="size-4" aria-hidden /> Yazdır
    </button>
  );
}

/** Yönetim: tablo yükleme */
export function ImportPlacementForm({ defaultYear }: { defaultYear: number }) {
  return (
    <ActionForm action={importPlacementAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Sınav">
          <Select name="exam" defaultValue="YKS">
            <option value="YKS">YKS (üniversite)</option>
            <option value="LGS">LGS (lise)</option>
          </Select>
        </Field>
        <Field label="Yerleştirme yılı">
          <Input name="year" type="number" min={2015} max={2100} defaultValue={defaultYear} required />
        </Field>
        <Field label="Dosya (.xlsx ya da .csv, en fazla 25 MB)">
          <Input name="file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </Field>
      </div>
      <Checkbox name="removeMissing" label="Bu yılın tabloda olmayan kayıtlarını sil (tam liste yüklüyorsanız işaretleyin)" />
      <SubmitButton pendingText="Aktarılıyor…">Aktar</SubmitButton>
    </ActionForm>
  );
}

export function DeletePlacementYearForm({ exam, year }: { exam: PlacementExamName; year: number }) {
  return (
    <ActionForm action={deletePlacementYearAction}>
      <input type="hidden" name="exam" value={exam} />
      <input type="hidden" name="year" value={year} />
      <SubmitButton size="sm" variant="outline" confirmMessage={`${exam} ${year} verisinin tamamı silinsin mi? Bu yılın programlarını içeren tercih listelerinden de düşer.`}>
        Sil
      </SubmitButton>
    </ActionForm>
  );
}

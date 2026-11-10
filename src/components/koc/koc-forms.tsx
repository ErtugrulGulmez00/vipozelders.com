"use client";

import { DateInput } from "@/components/ui/date-input";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  kocAddExamAction,
  kocAddQuestionLogAction,
  kocAssignResourceAction,
  kocCreateStudentAction,
  kocDeleteExamAction,
  kocDeleteQuestionLogAction,
  kocSetStudentActiveAction,
  kocSaveSettingsAction,
  kocUpdateStudentAction,
} from "@/actions/koc";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";
import { EXAM_PRESETS, type ExamKindName } from "@/lib/center/exams";
import { WEEKDAY_NAMES } from "@/lib/dates";

export const GRADES = ["5. sınıf", "6. sınıf", "7. sınıf", "8. sınıf", "9. sınıf", "10. sınıf", "11. sınıf", "12. sınıf", "Mezun"];
export const TARGETS = ["LGS", "YKS (Sayısal)", "YKS (Eşit Ağırlık)", "YKS (Sözel)", "YKS (Dil)", "Okul başarısı"];
const KINDS: ExamKindName[] = ["LGS", "TYT", "AYT_SAY", "AYT_EA", "AYT_SOZ", "YDT"];

export type KocStudentValues = {
  id?: string;
  firstName: string;
  lastName: string;
  gradeName: string | null;
  targetExam: string | null;
  schoolName: string | null;
  phone: string | null;
  notes: string | null;
  coachWeekday: number | null;
  coachTime: string;
};

export function KocStudentForm({ values }: { values?: KocStudentValues }) {
  const editing = Boolean(values?.id);
  return (
    <ActionForm action={editing ? kocUpdateStudentAction : kocCreateStudentAction} className="space-y-5">
      {values?.id ? <input type="hidden" name="studentId" value={values.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad">
          <Input name="firstName" defaultValue={values?.firstName} required maxLength={50} />
          <FieldError name="firstName" />
        </Field>
        <Field label="Soyad">
          <Input name="lastName" defaultValue={values?.lastName} required maxLength={50} />
          <FieldError name="lastName" />
        </Field>
        <Field label="Sınıf">
          <Select name="gradeName" defaultValue={values?.gradeName ?? ""}>
            <option value="">Seçin</option>
            {GRADES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hedef">
          <Select name="targetExam" defaultValue={values?.targetExam ?? ""}>
            <option value="">Seçin</option>
            {TARGETS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Okul (isteğe bağlı)">
          <Input name="schoolName" defaultValue={values?.schoolName ?? ""} maxLength={120} />
        </Field>
        <Field label="Öğrenci telefonu (isteğe bağlı)">
          <PhoneInput name="phone" defaultValue={values?.phone ?? ""} placeholder="05XX XXX XX XX" />
          <FieldError name="phone" />
        </Field>
      </div>
      <fieldset className="rounded-2xl bg-slate-50 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">Haftalık görüşme</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gün">
            <Select name="coachWeekday" defaultValue={values?.coachWeekday ?? ""}>
              <option value="">Belirlenmedi</option>
              {WEEKDAY_NAMES.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Saat">
            <Input name="coachTime" type="time" defaultValue={values?.coachTime ?? ""} />
            <FieldError name="coachTime" />
          </Field>
        </div>
      </fieldset>
      {editing ? null : (
        <fieldset className="rounded-2xl bg-slate-50 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">Veli (isteğe bağlı)</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ad soyad">
              <Input name="guardianName" maxLength={80} />
              <FieldError name="guardianName" />
            </Field>
            <Field label="Telefon">
              <PhoneInput name="guardianPhone" placeholder="05XX XXX XX XX" />
              <FieldError name="guardianPhone" />
            </Field>
            <Field label="E-posta">
              <Input name="guardianEmail" type="email" maxLength={120} />
              <FieldError name="guardianEmail" />
            </Field>
          </div>
        </fieldset>
      )}
      <Field label="Not (yalnızca siz görürsünüz)">
        <Textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} maxLength={2000} placeholder="Güçlü ve zayıf yönleri, hedef puan, veliyle ilgili notlar…" />
      </Field>
      <SubmitButton>{editing ? "Kaydet" : "Öğrenciyi ekle"}</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveStudentButton({ studentId, active }: { studentId: string; active: boolean }) {
  return (
    <ActionForm action={kocSetStudentActiveAction}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <SubmitButton size="sm" variant="outline" confirmMessage={active ? "Öğrenci arşive alınsın mı? Kayıtları silinmez." : undefined}>
        {active ? <Archive className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />} {active ? "Arşive al" : "Yeniden aktif yap"}
      </SubmitButton>
    </ActionForm>
  );
}

export function QuestionLogForm({ studentId, today, subjects }: { studentId: string; today: string; subjects: string[] }) {
  return (
    <ActionForm action={kocAddQuestionLogAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Gün">
          <DateInput name="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Ders">
          <Input name="subject" list={`koc-subjects-${studentId}`} required maxLength={60} placeholder="Matematik" />
          <datalist id={`koc-subjects-${studentId}`}>
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <FieldError name="subject" />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Çözülen">
          <Input name="solved" type="number" inputMode="numeric" min={1} max={5000} required />
          <FieldError name="solved" />
        </Field>
        <Field label="Doğru">
          <Input name="correct" type="number" inputMode="numeric" min={0} max={5000} />
          <FieldError name="correct" />
        </Field>
        <Field label="Yanlış">
          <Input name="wrong" type="number" inputMode="numeric" min={0} max={5000} />
        </Field>
      </div>
      <SubmitButton>Ekle</SubmitButton>
    </ActionForm>
  );
}

export function DeleteLogButton({ logId }: { logId: string }) {
  return (
    <ActionForm action={kocDeleteQuestionLogAction} hideMessages>
      <input type="hidden" name="logId" value={logId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Kayıt silinsin mi?" aria-label="Sil">
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

export function ExamForm({ studentId, today, defaultKind }: { studentId: string; today: string; defaultKind: ExamKindName }) {
  const [kind, setKind] = useState<ExamKindName>(defaultKind);
  const sections = EXAM_PRESETS[kind].sections;
  return (
    <ActionForm action={kocAddExamAction} resetOnSuccess className="space-y-4">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Sınav">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ExamKindName)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {EXAM_PRESETS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deneme adı">
          <Input name="name" required maxLength={120} placeholder="Yayınevi · Deneme 4" />
          <FieldError name="name" />
        </Field>
        <Field label="Tarih">
          <DateInput name="date" defaultValue={today} max={today} required />
        </Field>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1fr_72px_72px] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>Ders</span>
          <span className="text-center">Doğru</span>
          <span className="text-center">Yanlış</span>
        </div>
        {sections.map((s, i) => (
          <div key={`${kind}-${s.name}`} className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-t border-slate-100 px-3 py-1.5">
            <span className="text-sm text-slate-700">
              {s.name} <span className="text-xs text-slate-400">({s.questionCount})</span>
            </span>
            <Input name={`c${i}`} type="number" inputMode="numeric" min={0} max={s.questionCount} className="h-9 text-center" aria-label={`${s.name} doğru`} />
            <Input name={`w${i}`} type="number" inputMode="numeric" min={0} max={s.questionCount} className="h-9 text-center" aria-label={`${s.name} yanlış`} />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Net otomatik hesaplanır ({kind === "LGS" ? "3 yanlış 1 doğruyu götürür" : "4 yanlış 1 doğruyu götürür"}).</p>
      <SubmitButton>Sonucu kaydet</SubmitButton>
    </ActionForm>
  );
}

export function DeleteExamButton({ examId }: { examId: string }) {
  return (
    <ActionForm action={kocDeleteExamAction} hideMessages>
      <input type="hidden" name="examId" value={examId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Deneme sonucu silinsin mi?" aria-label="Sil">
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

export function AssignBookForm({ studentId, resources }: { studentId: string; resources: { id: string; label: string }[] }) {
  if (!resources.length) return null;
  return (
    <ActionForm action={kocAssignResourceAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="studentId" value={studentId} />
      <Field label="Kütüphanenizden kaynak ekleyin" className="min-w-0 flex-1">
        <Select name="resourceId" required>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>Ekle</SubmitButton>
    </ActionForm>
  );
}

export function KocSettingsForm({ values }: { values: { name: string; phone: string | null; email: string | null } }) {
  return (
    <ActionForm action={kocSaveSettingsAction} className="space-y-4">
      <Field label="Panelde ve veli mesajlarında görünen ad" hint="Ör. Ayşe Yılmaz Koçluk">
        <Input name="name" defaultValue={values.name} required maxLength={120} />
        <FieldError name="name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefon">
          <PhoneInput name="phone" defaultValue={values.phone ?? ""} placeholder="05XX XXX XX XX" />
          <FieldError name="phone" />
        </Field>
        <Field label="E-posta">
          <Input name="email" type="email" defaultValue={values.email ?? ""} maxLength={120} />
          <FieldError name="email" />
        </Field>
      </div>
      <SubmitButton>Kaydet</SubmitButton>
    </ActionForm>
  );
}

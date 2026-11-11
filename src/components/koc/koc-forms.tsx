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
  portalAddQuestionLogAction,
  portalDeleteQuestionLogAction,
  kocSaveReportAction,
  kocSaveGoalAction,
  kocDeleteGoalAction,
  portalSaveGoalAction,
  kocAddTopicToPlanAction,
  kocApplyTemplateAction,
  kocSaveTemplateAction,
  kocDeleteTemplateAction,
  kocSendReportAction,
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

/** portal: öğrencinin kendi hesabından giriş (koç panelinde değil) */
export function QuestionLogForm({ studentId, today, subjects, portal = false }: { studentId: string; today: string; subjects: string[]; portal?: boolean }) {
  return (
    <ActionForm action={portal ? portalAddQuestionLogAction : kocAddQuestionLogAction} resetOnSuccess className="space-y-3">
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

export function DeleteLogButton({ logId, portal = false }: { logId: string; portal?: boolean }) {
  return (
    <ActionForm action={portal ? portalDeleteQuestionLogAction : kocDeleteQuestionLogAction} hideMessages>
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

export function ReportNoteForm({ studentId, weekStart, note }: { studentId: string; weekStart: string; note: string | null }) {
  return (
    <ActionForm action={kocSaveReportAction} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <Field label="Bu haftanın değerlendirmesi" hint="Rapora olduğu gibi yazılır; veli görür.">
        <Textarea name="note" rows={5} maxLength={3000} defaultValue={note ?? ""} placeholder="Bu hafta programın büyük bölümünü uyguladı; paragrafta hızlandı. Gelecek hafta geometriye ağırlık vereceğiz…" />
      </Field>
      <SubmitButton variant="outline">Kaydet</SubmitButton>
    </ActionForm>
  );
}

export function SendReportButton({ studentId, weekStart, sentAt }: { studentId: string; weekStart: string; sentAt: string | null }) {
  return (
    <ActionForm action={kocSendReportAction} className="space-y-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <SubmitButton className="w-full" confirmMessage={sentAt ? "Bu rapor daha önce gönderildi. Yeniden gönderilsin mi?" : undefined}>
        Velilere gönder
      </SubmitButton>
      {sentAt ? <p className="text-xs text-slate-500">Son gönderim: {sentAt}</p> : null}
    </ActionForm>
  );
}

/** Hedef: sınav türü, hedef (okul/bölüm/puan) ve ders ders hedef net. portal: öğrencinin kendi formu. */
export function GoalForm({ studentId, initial, portal = false }: { studentId: string; initial?: { kind: ExamKindName; label: string | null; sectionNets: Record<string, number> }; portal?: boolean }) {
  const [kind, setKind] = useState<ExamKindName>(initial?.kind ?? "TYT");
  const sections = EXAM_PRESETS[kind].sections;
  const values = initial && initial.kind === kind ? initial.sectionNets : {};
  return (
    <ActionForm action={portal ? portalSaveGoalAction : kocSaveGoalAction} className="space-y-4">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
        <Field label="Sınav">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ExamKindName)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {EXAM_PRESETS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hedef (isteğe bağlı)">
          <Input name="label" maxLength={120} defaultValue={initial?.label ?? ""} placeholder="Örn. İTÜ Bilgisayar Mühendisliği" />
        </Field>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1fr_96px] gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>Ders</span>
          <span className="text-center">Hedef net</span>
        </div>
        {sections.map((s, i) => (
          <div key={`${kind}-${s.name}`} className="grid grid-cols-[1fr_96px] items-center gap-2 border-t border-slate-100 px-3 py-1.5">
            <span className="text-sm text-slate-700">
              {s.name} <span className="text-xs text-slate-400">({s.questionCount})</span>
            </span>
            <Input name={`t${i}`} type="number" inputMode="decimal" step="0.25" min={0} max={s.questionCount} defaultValue={values[s.name] ?? ""} className="h-9 text-center" aria-label={`${s.name} hedef net`} />
          </div>
        ))}
      </div>
      <SubmitButton>Hedefi kaydet</SubmitButton>
    </ActionForm>
  );
}

export function DeleteGoalButton({ studentId, kind }: { studentId: string; kind: ExamKindName }) {
  return (
    <ActionForm action={kocDeleteGoalAction} hideMessages>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Hedef silinsin mi?" aria-label="Hedefi sil">
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

/** Zayıf konuyu seçilen güne programa ekler (konu haritası). */
export function AddTopicToPlanForm({ studentId, subject, topic, resourceId, days }: { studentId: string; subject: string; topic: string; resourceId: string | null; days: { date: string; label: string }[] }) {
  return (
    <ActionForm action={kocAddTopicToPlanAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="subject" value={subject} />
      <input type="hidden" name="topic" value={topic} />
      {resourceId ? <input type="hidden" name="resourceId" value={resourceId} /> : null}
      <input type="hidden" name="targetQuestions" value="30" />
      <Select name="date" className="h-8 w-36 text-xs" aria-label={`${topic} hangi gün`} defaultValue={days[0]?.date}>
        {days.map((d) => (
          <option key={d.date} value={d.date}>
            {d.label}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="outline" className="h-8 px-3 text-xs" pendingText="…">
        Programa ekle
      </SubmitButton>
    </ActionForm>
  );
}

export function ApplyTemplateForm({ studentId, weekStart, templates }: { studentId: string; weekStart: string; templates: { id: string; name: string; description: string }[] }) {
  const [id, setId] = useState(templates[0]?.id ?? "");
  const chosen = templates.find((t) => t.id === id);
  return (
    <ActionForm action={kocApplyTemplateAction} className="space-y-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <Field label="Şablon">
        <Select name="templateId" value={id} onChange={(e) => setId(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      {chosen ? <p className="text-xs text-slate-500">{chosen.description}</p> : null}
      <SubmitButton size="sm">Bu haftaya uygula</SubmitButton>
    </ActionForm>
  );
}

export function SaveTemplateForm({ studentId, weekStart }: { studentId: string; weekStart: string }) {
  return (
    <ActionForm action={kocSaveTemplateAction} resetOnSuccess className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <Field label="Bu haftayı şablon olarak kaydet" className="min-w-0 flex-1">
        <Input name="name" required maxLength={80} placeholder="Örn. YKS son 3 ay haftası" />
      </Field>
      <SubmitButton size="sm" variant="outline">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  return (
    <ActionForm action={kocDeleteTemplateAction} hideMessages>
      <input type="hidden" name="templateId" value={templateId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Şablon silinsin mi?" aria-label="Şablonu sil">
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  createExamAction,
  deleteExamAction,
  importExamResultsAction,
  publishExamAction,
  saveAnswerKeyAction,
  saveResultsGridAction,
  saveStudentAnswersAction,
  updateExamAction,
} from "@/actions/center/exams";
import { ImportNotes } from "@/components/center/center-client";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { computeNet, EXAM_PRESETS, PENALTY_OPTIONS, type ExamKindName } from "@/lib/center/exams";

type Subject = { slug: string; name: string };

function penaltyValue(penalty: number) {
  return PENALTY_OPTIONS.find((p) => Math.abs(p.penalty - penalty) < 0.001)?.value ?? "0";
}

export function CreateExamForm({ subjects, today }: { subjects: Subject[]; today: string }) {
  const [kind, setKind] = useState<ExamKindName>("LGS");
  const [rows, setRows] = useState([{ name: "Matematik", count: "20", subject: "matematik" }]);
  const preset = EXAM_PRESETS[kind];
  return (
    <ActionForm action={createExamAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sınav türü">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as ExamKindName)}>
            {(Object.keys(EXAM_PRESETS) as ExamKindName[]).map((k) => (
              <option key={k} value={k}>
                {EXAM_PRESETS[k].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tarih">
          <Input name="date" type="date" defaultValue={today} required />
        </Field>
        <Field label="Deneme adı" className="sm:col-span-2">
          <Input name="name" placeholder={`Örn: ${preset.label} Türkiye Geneli 3`} required />
          <FieldError name="name" />
        </Field>
        <Field label="Yayınevi (isteğe bağlı)">
          <Input name="publisher" />
        </Field>
        <Field label="Yanlış götürme">
          <Select name="penalty" key={kind} defaultValue={penaltyValue(preset.wrongPenalty)}>
            {PENALTY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {kind === "CUSTOM" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Dersler</p>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_1fr_auto] gap-2">
              <Input name="sectionName" value={row.name} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} placeholder="Ders adı" aria-label="Ders adı" />
              <Input name="sectionCount" type="number" min={1} max={200} value={row.count} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)))} aria-label="Soru sayısı" />
              <Select name="sectionSubject" value={row.subject} onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, subject: e.target.value } : r)))} aria-label="Pazaryerindeki ders">
                <option value="">Pazaryeri dersi (öneri için)</option>
                {subjects.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Dersi kaldır">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setRows([...rows, { name: "", count: "10", subject: "" }])} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <Plus className="size-4" aria-hidden /> Ders ekle
          </button>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold">{preset.label} bölümleri</p>
          <p className="mt-1">{preset.sections.map((s) => `${s.name} (${s.questionCount})`).join(" · ")}</p>
        </div>
      )}
      <SubmitButton>Denemeyi oluştur</SubmitButton>
    </ActionForm>
  );
}

export function ExamMetaForm({ exam }: { exam: { id: string; name: string; date: string; publisher: string | null; wrongPenalty: number } }) {
  return (
    <ActionForm action={updateExamAction} className="space-y-3">
      <input type="hidden" name="examId" value={exam.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Deneme adı" className="sm:col-span-2">
          <Input name="name" defaultValue={exam.name} required />
        </Field>
        <Field label="Tarih">
          <Input name="date" type="date" defaultValue={exam.date} required />
        </Field>
        <Field label="Yayınevi">
          <Input name="publisher" defaultValue={exam.publisher ?? ""} />
        </Field>
        <Field label="Yanlış götürme" className="sm:col-span-2">
          <Select name="penalty" defaultValue={penaltyValue(exam.wrongPenalty)}>
            {PENALTY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SubmitButton size="sm" variant="outline">
          Kaydet
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteExamForm({ examId }: { examId: string }) {
  return (
    <ActionForm action={deleteExamAction}>
      <input type="hidden" name="examId" value={examId} />
      <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Deneme ve tüm sonuçları silinsin mi? Bu işlem geri alınamaz.">
        <Trash2 className="size-4" aria-hidden /> Denemeyi sil
      </SubmitButton>
    </ActionForm>
  );
}

export function PublishExamForm({ examId, isPublished }: { examId: string; isPublished: boolean }) {
  return (
    <ActionForm action={publishExamAction} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="publish" value={isPublished ? "0" : "1"} />
      {isPublished ? (
        <p className="text-sm text-slate-600">Sonuçlar veli portalında görünüyor.</p>
      ) : (
        <>
          <p className="text-sm text-slate-600">Yayınlayınca hesabını bağlamış velilere site/uygulama bildirimi gider; isterseniz tüm velilere WhatsApp ile de sonuç özeti gönderilir.</p>
          <div className="flex gap-4">
            <Checkbox name="whatsapp" defaultChecked label="WhatsApp ile de gönder" />
          </div>
        </>
      )}
      <SubmitButton size="sm" variant={isPublished ? "outline" : "primary"} confirmMessage={isPublished ? "Sonuçlar veli portalından kaldırılsın mı?" : "Sonuçlar velilere açılsın mı?"}>
        {isPublished ? "Yayından kaldır" : "Velilere yayınla"}
      </SubmitButton>
    </ActionForm>
  );
}

type GridSection = { id: string; name: string; questionCount: number };
type GridStudent = { id: string; name: string; studentNumber: string | null; values: Record<string, { d: number; y: number }>; score: number | null; hasResult: boolean };

/** Sonuç tablosu: öğrenci × ders D/Y girişi, anlık net hesabı. */
export function ResultsGrid({ examId, sections, students, penalty }: { examId: string; sections: GridSection[]; students: GridStudent[]; penalty: number }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const s of students) {
      for (const sec of sections) {
        const v = s.values[sec.id];
        if (v) {
          init[`d:${s.id}:${sec.id}`] = String(v.d);
          init[`y:${s.id}:${sec.id}`] = String(v.y);
        }
      }
    }
    return init;
  });
  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value.replace(/[^\d]/g, "").slice(0, 3) }));
  const netOf = (studentId: string) =>
    sections.reduce((total, sec) => {
      const d = Number(values[`d:${studentId}:${sec.id}`] || 0);
      const y = Number(values[`y:${studentId}:${sec.id}`] || 0);
      return total + computeNet(d, y, penalty);
    }, 0);
  return (
    <ActionForm action={saveResultsGridAction} className="space-y-4">
      <input type="hidden" name="examId" value={examId} />
      {sections.map((s) => (
        <input key={s.id} type="hidden" name="sectionIds" value={s.id} />
      ))}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left">Öğrenci</th>
              {sections.map((s) => (
                <th key={s.id} className="border-l border-slate-200 px-2 py-2 text-center" colSpan={2}>
                  {s.name} <span className="font-normal normal-case">({s.questionCount})</span>
                </th>
              ))}
              <th className="border-l border-slate-200 px-2 py-2">Puan</th>
              <th className="px-2 py-2">Net</th>
              <th className="px-2 py-2">Sil</th>
            </tr>
            <tr className="bg-slate-50 text-[11px] text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50" />
              {sections.map((s) => (
                <SectionSubHeader key={s.id} />
              ))}
              <th className="border-l border-slate-200" />
              <th />
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((student) => {
              const over = sections.some((sec) => Number(values[`d:${student.id}:${sec.id}`] || 0) + Number(values[`y:${student.id}:${sec.id}`] || 0) > sec.questionCount);
              return (
                <tr key={student.id} className={over ? "bg-rose-50" : undefined}>
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5">
                    <input type="hidden" name="studentIds" value={student.id} />
                    <span className="font-medium text-slate-900">{student.name}</span>
                    {student.studentNumber ? <span className="ml-1 font-mono text-[11px] text-slate-400">{student.studentNumber}</span> : null}
                  </td>
                  {sections.map((sec) => (
                    <SectionCells key={sec.id} studentId={student.id} sectionId={sec.id} values={values} set={set} />
                  ))}
                  <td className="border-l border-slate-200 px-1 py-1">
                    <input name={`puan:${student.id}`} defaultValue={student.score ?? ""} inputMode="decimal" className="h-8 w-16 rounded-md border border-slate-300 px-1.5 text-center text-sm" aria-label={`${student.name} puan`} />
                  </td>
                  <td className="px-2 py-1 text-center font-bold text-slate-900">{netOf(student.id).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1 text-center">{student.hasResult ? <input type="checkbox" name={`clear:${student.id}`} className="size-4 accent-rose-600" aria-label={`${student.name} sonucunu sil`} /> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Boş bırakılan satırlar kaydedilmez. Kırmızı satırda doğru + yanlış soru sayısını aşıyor.</p>
        <SubmitButton size="lg">Sonuçları kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}

function SectionSubHeader() {
  return (
    <>
      <th className="border-l border-slate-200 px-1 py-1 font-semibold text-emerald-700">D</th>
      <th className="px-1 py-1 font-semibold text-rose-700">Y</th>
    </>
  );
}

function SectionCells({ studentId, sectionId, values, set }: { studentId: string; sectionId: string; values: Record<string, string>; set: (key: string, value: string) => void }) {
  const dKey = `d:${studentId}:${sectionId}`;
  const yKey = `y:${studentId}:${sectionId}`;
  return (
    <>
      <td className="border-l border-slate-200 px-1 py-1">
        <input name={dKey} value={values[dKey] ?? ""} onChange={(e) => set(dKey, e.target.value)} inputMode="numeric" className="h-8 w-11 rounded-md border border-slate-300 px-1 text-center text-sm focus:border-emerald-500 focus:outline-none" aria-label="Doğru" />
      </td>
      <td className="px-1 py-1">
        <input name={yKey} value={values[yKey] ?? ""} onChange={(e) => set(yKey, e.target.value)} inputMode="numeric" className="h-8 w-11 rounded-md border border-slate-300 px-1 text-center text-sm focus:border-rose-500 focus:outline-none" aria-label="Yanlış" />
      </td>
    </>
  );
}

export function AnswerKeyForm({ examId, sections }: { examId: string; sections: { id: string; name: string; questionCount: number; answerKey: string | null; topicsText: string }[] }) {
  return (
    <ActionForm action={saveAnswerKeyAction} className="space-y-5">
      <input type="hidden" name="examId" value={examId} />
      {sections.map((s) => (
        <fieldset key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <input type="hidden" name="sectionIds" value={s.id} />
          <legend className="px-1 text-sm font-semibold text-slate-900">
            {s.name} <span className="font-normal text-slate-500">({s.questionCount} soru)</span>
          </legend>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="Cevap anahtarı" hint="Örn: ABCDA BDCEA… (iptal edilen soru için X). Boşluklar önemsiz.">
              <Textarea name={`key:${s.id}`} rows={3} defaultValue={s.answerKey ?? ""} className="font-mono uppercase tracking-widest" spellCheck={false} />
            </Field>
            <Field label="Konu dağılımı (isteğe bağlı)" hint="Her satıra “1-3: Üslü sayılar” gibi soru aralığı ve konu yazın.">
              <Textarea name={`topics:${s.id}`} rows={3} defaultValue={s.topicsText} placeholder={"1-3: Çarpanlar ve katlar\n4-6: Üslü ifadeler"} />
            </Field>
          </div>
        </fieldset>
      ))}
      <SubmitButton size="lg">Anahtarı ve konuları kaydet</SubmitButton>
    </ActionForm>
  );
}

export function ExamImportForm({ examId }: { examId: string }) {
  return (
    <ActionForm action={importExamResultsAction} className="space-y-4">
      <input type="hidden" name="examId" value={examId} />
      <ImportNotes />
      <FileInput name="file" accept=".xlsx,.csv" required />
      <SubmitButton pendingText="Aktarılıyor…">Sonuçları aktar</SubmitButton>
    </ActionForm>
  );
}

export function StudentAnswersForm({ examId, studentId, sections, score }: { examId: string; studentId: string; sections: { id: string; name: string; questionCount: number; hasKey: boolean; answers: string | null }[]; score: number | null }) {
  return (
    <ActionForm action={saveStudentAnswersAction} className="space-y-3">
      <input type="hidden" name="examId" value={examId} />
      <input type="hidden" name="studentId" value={studentId} />
      {sections.map((s) => (
        <Field key={s.id} label={`${s.name} (${s.questionCount} soru)`} hint={s.hasKey ? "Boş bıraktığı soru için - yazın." : "Bu ders için önce cevap anahtarını girin."}>
          <input type="hidden" name="sectionIds" value={s.id} />
          <Input name={`answers:${s.id}`} defaultValue={s.answers ?? ""} disabled={!s.hasKey} className="font-mono uppercase tracking-widest" spellCheck={false} autoComplete="off" />
        </Field>
      ))}
      <Field label="Puan (isteğe bağlı)">
        <Input name="score" inputMode="decimal" defaultValue={score ?? ""} className="w-32" />
      </Field>
      <SubmitButton size="sm">Cevapları oku ve kaydet</SubmitButton>
    </ActionForm>
  );
}

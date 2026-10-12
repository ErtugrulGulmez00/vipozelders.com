"use client";

import { useMemo, useState } from "react";
import { completeEtudAction, deleteEtudAction, saveEtudAction, setEtudStatusAction } from "@/actions/center/classes";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { normalizeSearch } from "@/lib/text";

type Option = { id: string; name: string };
type StudentOption = Option & { groups: string };

export type EtudValues = {
  id?: string;
  date: string;
  start: string;
  end: string;
  teacherId: string | null;
  subject?: string;
  topic?: string | null;
  room?: string | null;
  notes?: string | null;
  studentIds?: string[];
};

export function EtudForm({ teachers, students, values, teacherLocked }: { teachers: Option[]; students: StudentOption[]; values: EtudValues; teacherLocked: boolean }) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(() => new Set(values.studentIds ?? []));
  const visible = useMemo(() => {
    const q = normalizeSearch(filter);
    return q ? students.filter((s) => normalizeSearch(`${s.name} ${s.groups}`).includes(q)) : students;
  }, [filter, students]);
  return (
    <ActionForm action={saveEtudAction} className="space-y-4">
      {values.id ? <input type="hidden" name="etudId" value={values.id} /> : null}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tarih">
          <Input name="date" type="date" defaultValue={values.date} required />
        </Field>
        <Field label="Başlangıç">
          <Input name="start" type="time" defaultValue={values.start} required />
        </Field>
        <Field label="Bitiş">
          <Input name="end" type="time" defaultValue={values.end} required />
        </Field>
        <Field label="Ders">
          <Input name="subject" defaultValue={values.subject} placeholder="Matematik" required />
          <FieldError name="subject" />
        </Field>
        <Field label="Konu">
          <Input name="topic" defaultValue={values.topic ?? ""} placeholder="Örn: Üslü ifadeler" />
        </Field>
        <Field label="Derslik">
          <Input name="room" defaultValue={values.room ?? ""} />
        </Field>
        <Field label="Öğretmen" className="sm:col-span-3">
          <Select name="teacherId" defaultValue={values.teacherId ?? ""} disabled={teacherLocked}>
            <option value="">Seçin</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-700">Öğrenciler ({selected.size} seçili)</p>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Ad ya da sınıf ara" className="h-8 w-52" />
        </div>
        <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
          {visible.map((s) => (
            <Checkbox
              key={s.id}
              checked={selected.has(s.id)}
              onChange={(e) => {
                const next = new Set(selected);
                if (e.target.checked) next.add(s.id);
                else next.delete(s.id);
                setSelected(next);
              }}
              label={
                <>
                  {s.name} {s.groups ? <span className="text-xs text-slate-500">· {s.groups}</span> : null}
                </>
              }
            />
          ))}
        </div>
      </div>
      <Field label="Not">
        <Textarea name="notes" rows={2} defaultValue={values.notes ?? ""} />
      </Field>
      <SubmitButton>{values.id ? "Etüdü güncelle" : "Etüdü planla"}</SubmitButton>
    </ActionForm>
  );
}

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export function EtudAttendanceForm({ etudId, students, notes, notifyAvailable }: { etudId: string; students: { id: string; name: string; status: Status | null }[]; notes: string | null; notifyAvailable: boolean }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, s.status ?? "PRESENT"])));
  const options: { value: Status; label: string; active: string }[] = [
    { value: "PRESENT", label: "Geldi", active: "bg-emerald-600 text-white border-emerald-600" },
    { value: "ABSENT", label: "Gelmedi", active: "bg-rose-600 text-white border-rose-600" },
    { value: "LATE", label: "Geç", active: "bg-amber-500 text-white border-amber-500" },
    { value: "EXCUSED", label: "İzinli", active: "bg-sky-600 text-white border-sky-600" },
  ];
  return (
    <ActionForm action={completeEtudAction} className="space-y-4">
      <input type="hidden" name="etudId" value={etudId} />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {students.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <input type="hidden" name="studentIds" value={s.id} />
            <input type="hidden" name={`status:${s.id}`} value={statuses[s.id]} />
            <span className="font-medium text-slate-900">{s.name}</span>
            <div className="flex gap-1">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={statuses[s.id] === o.value}
                  onClick={() => setStatuses({ ...statuses, [s.id]: o.value })}
                  className={cn("rounded-lg border px-2.5 py-1 text-xs font-semibold", statuses[s.id] === o.value ? o.active : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Field label="Etüt notu (işlenen konu, ödev)">
        <Textarea name="notes" rows={2} defaultValue={notes ?? ""} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {notifyAvailable ? <Checkbox name="notify" defaultChecked label="Gelmeyenlerin velisine bildirim gönder" /> : <span />}
        <SubmitButton>Etüt yapıldı olarak kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EtudStatusButtons({ etudId, status }: { etudId: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={setEtudStatusAction}>
        <input type="hidden" name="etudId" value={etudId} />
        <input type="hidden" name="status" value={status === "CANCELLED" ? "PLANNED" : "CANCELLED"} />
        <SubmitButton size="sm" variant="outline" pendingText="…" confirmMessage={status === "CANCELLED" ? undefined : "Etüt iptal edilsin mi?"}>
          {status === "CANCELLED" ? "Yeniden planla" : "İptal et"}
        </SubmitButton>
      </ActionForm>
      <ActionForm action={deleteEtudAction}>
        <input type="hidden" name="etudId" value={etudId} />
        <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Etüt tamamen silinsin mi?">
          Sil
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

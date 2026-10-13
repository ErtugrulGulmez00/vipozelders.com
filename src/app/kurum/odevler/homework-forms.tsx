"use client";

import { useMemo, useState } from "react";
import { checkHomeworkAction, createHomeworkAction, deleteHomeworkAction } from "@/actions/center/homework";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { normalizeSearch } from "@/lib/text";

export function HomeworkForm({ groups, students, today, nextWeek }: { groups: { id: string; name: string }[]; students: { id: string; name: string; groups: string }[]; today: string; nextWeek: string }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());
  const visible = useMemo(() => {
    const q = normalizeSearch(filter);
    return q ? students.filter((s) => normalizeSearch(`${s.name} ${s.groups}`).includes(q)) : students;
  }, [filter, students]);
  return (
    <ActionForm action={createHomeworkAction} className="space-y-3">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      <Field label="Kime">
        <Select name="groupId" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} (tüm sınıf)
            </option>
          ))}
          <option value="">Yalnızca seçtiğim öğrenciler</option>
        </Select>
        <FieldError name="groupId" />
      </Field>
      {!groupId ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm text-slate-600">{selected.size} öğrenci seçili</span>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Öğrenci ara" className="h-8 w-48" />
          </div>
          <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3">
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
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ders">
          <Input name="subject" placeholder="Matematik" required />
          <FieldError name="subject" />
        </Field>
        <Field label="Teslim tarihi">
          <Input name="dueDate" type="date" defaultValue={nextWeek} required />
          <FieldError name="dueDate" />
        </Field>
      </div>
      <input type="hidden" name="assignedOn" value={today} />
      <Field label="Ödev">
        <Input name="title" placeholder="Örn: Üslü ifadeler testi 1-3 (sayfa 42-47)" required />
        <FieldError name="title" />
      </Field>
      <Field label="Açıklama (isteğe bağlı)">
        <Textarea name="description" rows={2} />
      </Field>
      <Checkbox name="notifyEmail" label="Velilere e-postayla da bildir (portala bağlı velilere bildirim her zaman gider)" />
      <SubmitButton>Ödevi ver</SubmitButton>
    </ActionForm>
  );
}

type Status = "PENDING" | "DONE" | "PARTIAL" | "MISSING";
const OPTIONS: { value: Status; label: string; active: string }[] = [
  { value: "DONE", label: "Yaptı", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "PARTIAL", label: "Eksik", active: "bg-amber-500 text-white border-amber-500" },
  { value: "MISSING", label: "Yapmadı", active: "bg-rose-600 text-white border-rose-600" },
];

export function HomeworkCheckForm({ homeworkId, students }: { homeworkId: string; students: { id: string; name: string; status: Status; note: string | null; notified: boolean }[] }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, s.status])));
  return (
    <ActionForm action={checkHomeworkAction} className="space-y-4">
      <input type="hidden" name="homeworkId" value={homeworkId} />
      <div className="flex justify-end">
        <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.id, "DONE" as Status])))}>
          Hepsini “Yaptı” yap
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {students.map((s) => (
          <li key={s.id} className="px-4 py-3">
            <input type="hidden" name="studentIds" value={s.id} />
            <input type="hidden" name={`status:${s.id}`} value={statuses[s.id]} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{s.name}</p>
                {s.notified ? <p className="text-xs text-slate-500">Veliye bildirildi</p> : null}
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} ödev durumu`}>
                {OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={statuses[s.id] === o.value}
                    onClick={() => setStatuses({ ...statuses, [s.id]: o.value })}
                    className={cn("rounded-lg border px-3 py-1.5 text-xs font-semibold", statuses[s.id] === o.value ? o.active : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <Input name={`note:${s.id}`} defaultValue={s.note ?? ""} placeholder="Not (isteğe bağlı)" className="mt-2 h-8" />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox name="notify" defaultChecked label="Ödevi yapmayanların velisine bildirim gönder (her öğrenci için bir kez)" />
        <SubmitButton size="lg">Kontrolü kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteHomeworkButton({ homeworkId }: { homeworkId: string }) {
  return (
    <ActionForm action={deleteHomeworkAction}>
      <input type="hidden" name="homeworkId" value={homeworkId} />
      <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Ödev silinsin mi?">
        Ödevi sil
      </SubmitButton>
    </ActionForm>
  );
}

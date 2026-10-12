"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { archiveGroupAction, deleteSlotAction, saveGroupAction, saveSlotAction, setGroupStudentsAction } from "@/actions/center/classes";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { GRADE_OPTIONS, TARGET_EXAMS } from "@/lib/center/labels";
import { WEEKDAY_NAMES } from "@/lib/dates";
import { normalizeSearch } from "@/lib/text";

type Teacher = { id: string; name: string };

export type GroupValues = { id?: string; name?: string; gradeName?: string | null; targetExam?: string | null; teacherId?: string | null; room?: string | null; capacity?: number | null };

export function GroupForm({ teachers, values = {} }: { teachers: Teacher[]; values?: GroupValues }) {
  return (
    <ActionForm action={saveGroupAction} resetOnSuccess={!values.id} className="space-y-3">
      {values.id ? <input type="hidden" name="groupId" value={values.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sınıf / grup adı" hint="Örn: 8-A LGS, 12 Sayısal, Hafta sonu TYT">
          <Input name="name" defaultValue={values.name} required />
          <FieldError name="name" />
        </Field>
        <Field label="Sorumlu öğretmen (rehber)">
          <Select name="teacherId" defaultValue={values.teacherId ?? ""}>
            <option value="">Seçin</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sınıf seviyesi">
          <Select name="gradeName" defaultValue={values.gradeName ?? ""}>
            <option value="">Seçin</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Hedef">
          <Select name="targetExam" defaultValue={values.targetExam ?? ""}>
            <option value="">Seçin</option>
            {TARGET_EXAMS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Derslik">
          <Input name="room" defaultValue={values.room ?? ""} placeholder="Örn: 2. kat A dersliği" />
        </Field>
        <Field label="Kontenjan">
          <Input name="capacity" type="number" min={0} max={500} defaultValue={values.capacity ?? ""} />
        </Field>
      </div>
      <SubmitButton size="sm">{values.id ? "Kaydet" : "Sınıf oluştur"}</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveGroupForm({ groupId, isActive }: { groupId: string; isActive: boolean }) {
  return (
    <ActionForm action={archiveGroupAction}>
      <input type="hidden" name="groupId" value={groupId} />
      {isActive ? (
        <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Sınıf silinsin mi? Yoklama geçmişi varsa silinmez, arşive alınır.">
          <Trash2 className="size-4" aria-hidden /> Sınıfı sil / arşivle
        </SubmitButton>
      ) : (
        <>
          <input type="hidden" name="restore" value="1" />
          <SubmitButton size="sm" variant="outline" pendingText="…">
            Arşivden çıkar
          </SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function GroupStudentsForm({ groupId, students, selected }: { groupId: string; students: { id: string; name: string; gradeName: string | null }[]; selected: string[] }) {
  const [filter, setFilter] = useState("");
  const [checked, setChecked] = useState(() => new Set(selected));
  const visible = useMemo(() => {
    const q = normalizeSearch(filter);
    return q ? students.filter((s) => normalizeSearch(`${s.name} ${s.gradeName ?? ""}`).includes(q)) : students;
  }, [filter, students]);
  return (
    <ActionForm action={setGroupStudentsAction} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Öğrenci ara" className="h-9 w-56" />
        <span className="text-sm text-slate-500">{checked.size} öğrenci seçili</span>
      </div>
      <div className="grid max-h-80 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
        {visible.map((s) => (
          <Checkbox
            key={s.id}
            checked={checked.has(s.id)}
            onChange={(e) => {
              const next = new Set(checked);
              if (e.target.checked) next.add(s.id);
              else next.delete(s.id);
              setChecked(next);
            }}
            label={
              <>
                {s.name} {s.gradeName ? <span className="text-xs text-slate-500">· {s.gradeName}</span> : null}
              </>
            }
          />
        ))}
        {visible.length === 0 ? <p className="text-sm text-slate-500">Öğrenci bulunamadı.</p> : null}
      </div>
      <SubmitButton size="sm">Sınıf listesini kaydet</SubmitButton>
    </ActionForm>
  );
}

export function SlotForm({ groupId, teachers, defaultRoom }: { groupId: string; teachers: Teacher[]; defaultRoom?: string | null }) {
  return (
    <ActionForm action={saveSlotAction} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Gün">
          <Select name="weekday" defaultValue="1">
            {WEEKDAY_NAMES.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Başlangıç">
          <Input name="start" type="time" defaultValue="16:00" required />
        </Field>
        <Field label="Bitiş">
          <Input name="end" type="time" defaultValue="16:40" required />
        </Field>
        <Field label="Ders">
          <Input name="subject" placeholder="Matematik" required />
          <FieldError name="subject" />
        </Field>
        <Field label="Öğretmen">
          <Select name="teacherId" defaultValue="">
            <option value="">Seçin</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Derslik">
          <Input name="room" defaultValue={defaultRoom ?? ""} />
        </Field>
      </div>
      <SubmitButton size="sm">Programa ekle</SubmitButton>
    </ActionForm>
  );
}

export function DeleteSlotButton({ slotId }: { slotId: string }) {
  return (
    <ActionForm action={deleteSlotAction} hideMessages>
      <input type="hidden" name="slotId" value={slotId} />
      <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600" pendingText="…" confirmMessage="Ders programdan çıkarılsın mı?">
        Çıkar
      </SubmitButton>
    </ActionForm>
  );
}

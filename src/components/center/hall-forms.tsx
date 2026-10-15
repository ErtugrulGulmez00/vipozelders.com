"use client";

import { useMemo, useState } from "react";
import { addHallStudentsAction, createHallAction, deleteHallAction, saveHallDayAction, updateHallAction, updateHallStudentAction } from "@/actions/center/study-hall";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { normalizeSearch } from "@/lib/text";

const DEFAULT_PERIODS = "09:00-09:45\n10:00-10:45\n11:00-11:45\n13:00-13:45\n14:00-14:45\n15:00-15:45\n16:00-16:45\n18:00-18:45\n19:00-19:45\n20:00-20:45";

export function HallForm({ initial }: { initial?: { id: string; name: string; periods: string[]; isActive: boolean } }) {
  return (
    <ActionForm action={initial ? updateHallAction : createHallAction} className="space-y-3">
      {initial ? <input type="hidden" name="hallId" value={initial.id} /> : null}
      <Field label="Salon adı">
        <Input name="name" defaultValue={initial?.name} placeholder="Örn: YKS çalışma salonu" required />
        <FieldError name="name" />
      </Field>
      <Field label="Periyotlar" hint="Her satıra bir periyot: 09:00-09:45. Yoklama bu sütunlarla alınır.">
        <Textarea name="periods" rows={6} defaultValue={initial ? initial.periods.join("\n") : DEFAULT_PERIODS} required />
        <FieldError name="periods" />
      </Field>
      {initial ? <Checkbox name="archived" defaultChecked={!initial.isActive} label="Arşivle" /> : null}
      <SubmitButton>{initial ? "Kaydet" : "Salonu ekle"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteHallButton({ hallId }: { hallId: string }) {
  return (
    <ActionForm action={deleteHallAction}>
      <input type="hidden" name="hallId" value={hallId} />
      <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Salon ve tüm yoklama kayıtları silinsin mi?">
        Salonu sil
      </SubmitButton>
    </ActionForm>
  );
}

type Mark = "G" | "Y" | "-";
const NEXT: Record<Mark, Mark> = { "-": "G", G: "Y", Y: "-" };
const STYLE: Record<Mark, string> = { G: "bg-emerald-500 text-white", Y: "bg-rose-500 text-white", "-": "bg-slate-100 text-slate-400" };
const LABEL: Record<Mark, string> = { G: "Geldi", Y: "Gelmedi", "-": "—" };

/** Periyot tablosu: hücreye tıklayınca — → Geldi → Gelmedi döner; satır/sütun hızlı doldurma. */
export function HallGrid({ hallId, date, periods, students }: { hallId: string; date: string; periods: string[]; students: { id: string; name: string; deskNo: string | null; marks: string }[] }) {
  const [marks, setMarks] = useState<Record<string, Mark[]>>(() => Object.fromEntries(students.map((s) => [s.id, periods.map((_, i) => (s.marks[i] as Mark) ?? "-")])));
  const set = (id: string, i: number, value: Mark) => setMarks((m) => ({ ...m, [id]: m[id].map((v, j) => (j === i ? value : v)) }));
  const fillColumn = (i: number, value: Mark) => setMarks((m) => Object.fromEntries(Object.entries(m).map(([id, row]) => [id, row.map((v, j) => (j === i ? value : v))])));
  const fillRow = (id: string, value: Mark) => setMarks((m) => ({ ...m, [id]: m[id].map(() => value) }));
  return (
    <ActionForm action={saveHallDayAction} className="space-y-3">
      <input type="hidden" name="hallId" value={hallId} />
      <input type="hidden" name="date" value={date} />
      {students.map((s) => (
        <span key={s.id}>
          <input type="hidden" name="studentIds" value={s.id} />
          <input type="hidden" name={`marks:${s.id}`} value={marks[s.id].join("")} />
        </span>
      ))}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Öğrenci</th>
              {periods.map((p, i) => (
                <th key={p} className="px-1 py-2 text-center font-medium">
                  <p>{i + 1}. periyot</p>
                  <p className="font-normal text-slate-400">{p}</p>
                  <button type="button" onClick={() => fillColumn(i, "G")} className="mt-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-slate-200 hover:bg-emerald-50">
                    Hepsi geldi
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id}>
                <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5">
                  <p className="font-semibold text-slate-900">{s.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {s.deskNo ? `Masa ${s.deskNo} · ` : ""}
                    <button type="button" className="font-semibold text-emerald-700 hover:underline" onClick={() => fillRow(s.id, "G")}>
                      gün boyu geldi
                    </button>
                    {" · "}
                    <button type="button" className="font-semibold text-rose-700 hover:underline" onClick={() => fillRow(s.id, "Y")}>
                      gelmedi
                    </button>
                  </p>
                </td>
                {periods.map((p, i) => {
                  const value = marks[s.id][i];
                  return (
                    <td key={p} className="px-1 py-1.5 text-center">
                      <button type="button" onClick={() => set(s.id, i, NEXT[value])} className={cn("h-7 w-16 rounded-md font-semibold", STYLE[value])} aria-label={`${s.name} ${i + 1}. periyot: ${LABEL[value]}`}>
                        {LABEL[value]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Checkbox name="notify" label="Gün boyu hiç gelmeyenlerin velisine bildirim gönder (her gün bir kez)" />
        <SubmitButton size="lg">Salon yoklamasını kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AddHallStudentsForm({ hallId, groups, students }: { hallId: string; groups: { id: string; name: string }[]; students: { id: string; name: string; groups: string }[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());
  const visible = useMemo(() => {
    const q = normalizeSearch(filter);
    return q ? students.filter((s) => normalizeSearch(`${s.name} ${s.groups}`).includes(q)) : students;
  }, [filter, students]);
  return (
    <ActionForm action={addHallStudentsAction} className="space-y-3">
      <input type="hidden" name="hallId" value={hallId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      <Field label="Kimleri ekleyelim?">
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
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Öğrenci ara" className="mb-2 h-8" aria-label="Öğrenci ara" />
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
      <SubmitButton size="sm">Salona ekle</SubmitButton>
    </ActionForm>
  );
}

export function HallStudentRow({ hallId, studentId, name, deskNo }: { hallId: string; studentId: string; name: string; deskNo: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-slate-800">{name}</span>
      <div className="flex items-center gap-1">
        <ActionForm action={updateHallStudentAction} hideMessages className="flex items-center gap-1">
          <input type="hidden" name="hallId" value={hallId} />
          <input type="hidden" name="studentId" value={studentId} />
          <Input name="deskNo" defaultValue={deskNo ?? ""} placeholder="Masa" className="h-7 w-16 px-2 text-xs" aria-label={`${name} masa no`} />
          <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs" pendingText="…">
            Kaydet
          </SubmitButton>
        </ActionForm>
        <ActionForm action={updateHallStudentAction} hideMessages>
          <input type="hidden" name="hallId" value={hallId} />
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="remove" value="on" />
          <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600" pendingText="…" confirmMessage={`${name} salondan çıkarılsın mı?`}>
            Çıkar
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

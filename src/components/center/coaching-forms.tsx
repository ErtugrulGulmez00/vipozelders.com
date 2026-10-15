"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { addCoachingSessionAction, deleteCoachingSessionAction, saveCoachAssignmentsAction } from "@/actions/center/coaching";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { WEEKDAY_NAMES } from "@/lib/dates";
import { normalizeSearch } from "@/lib/text";

type AssignRow = { id: string; name: string; groups: string; coachId: string | null; weekday: number | null; time: string };

/** Koç ve haftalık görüşme saati ataması (toplu). */
export function CoachAssignForm({ rows, coaches }: { rows: AssignRow[]; coaches: { id: string; name: string }[] }) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const q = normalizeSearch(filter);
    return q ? rows.filter((r) => normalizeSearch(`${r.name} ${r.groups}`).includes(q)) : rows;
  }, [filter, rows]);
  return (
    <ActionForm action={saveCoachAssignmentsAction} className="space-y-3">
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Öğrenci ya da sınıf ara" className="h-9 sm:w-64" aria-label="Öğrenci ara" />
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Öğrenci</th>
              <th className="px-2 py-2 font-medium">Koç</th>
              <th className="px-2 py-2 font-medium">Görüşme günü</th>
              <th className="px-2 py-2 font-medium">Saat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={visible.includes(r) ? undefined : "hidden"}>
                <td className="px-3 py-1.5">
                  <input type="hidden" name="studentIds" value={r.id} />
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.groups}</p>
                </td>
                <td className="px-2 py-1.5">
                  <Select name={`coach:${r.id}`} defaultValue={r.coachId ?? ""} className="h-8" aria-label={`${r.name} koçu`}>
                    <option value="">Koç yok</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Select name={`weekday:${r.id}`} defaultValue={r.weekday ?? ""} className="h-8" aria-label={`${r.name} görüşme günü`}>
                    <option value="">—</option>
                    {WEEKDAY_NAMES.map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-2 py-1.5">
                  <Input name={`time:${r.id}`} type="time" step={900} defaultValue={r.time} className="h-8 w-28" aria-label={`${r.name} görüşme saati`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubmitButton>Atamaları kaydet</SubmitButton>
    </ActionForm>
  );
}

/** Görüşme kaydı (koç). */
export function CoachingSessionForm({ studentId, today, suggestions }: { studentId: string; today: string; suggestions: string[] }) {
  const [missed, setMissed] = useState(false);
  return (
    <ActionForm action={addCoachingSessionAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Görüşme tarihi">
          <Input name="date" type="date" defaultValue={today} required />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox name="missed" checked={missed} onChange={(e) => setMissed(e.target.checked)} label="Görüşme yapılamadı (öğrenci gelmedi)" />
        </div>
      </div>
      <Field label={missed ? "Not (isteğe bağlı)" : "Görüşme notu"}>
        <Textarea name="notes" rows={4} maxLength={4000} placeholder="Bu hafta ne konuştunuz? Program uygulandı mı, deneme sonucu, motivasyon, veliyle ilgili notlar…" required={!missed} />
        <FieldError name="notes" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Öncelikli konular" hint="Virgülle ayırın. Konu analizinden sık geçenler aşağıda.">
          <Input name="priorityTopics" list={`coach-topics-${studentId}`} placeholder="Üslü ifadeler, Paragraf" />
          <datalist id={`coach-topics-${studentId}`}>
            {suggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Gelecek haftanın hedefi (isteğe bağlı)">
          <Input name="nextGoal" maxLength={500} placeholder="Günde 60 soru, 2 deneme" />
        </Field>
      </div>
      <Checkbox name="visibleToParent" label="Bu görüşme notu veli portalında görünsün" />
      <SubmitButton>Görüşmeyi kaydet</SubmitButton>
    </ActionForm>
  );
}

export function DeleteCoachingButton({ sessionId }: { sessionId: string }) {
  return (
    <ActionForm action={deleteCoachingSessionAction} hideMessages>
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" confirmMessage="Görüşme kaydı silinsin mi?" aria-label="Sil">
        <Trash2 className="size-3.5" aria-hidden />
      </SubmitButton>
    </ActionForm>
  );
}

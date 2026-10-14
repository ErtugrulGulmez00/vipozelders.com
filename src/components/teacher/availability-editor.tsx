"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addExceptionAction, removeExceptionAction, saveAvailabilityAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { WEEKDAY_NAMES } from "@/lib/dates";

type Interval = { start: string; end: string };

export function WeeklyAvailabilityEditor({
  teacherId,
  initialRules,
  bufferMinutes,
}: {
  teacherId: string;
  initialRules: { weekday: number; start: string; end: string }[];
  bufferMinutes: number;
}) {
  const [week, setWeek] = useState<Record<number, Interval[]>>(() => {
    const map: Record<number, Interval[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    for (const r of initialRules) map[r.weekday].push({ start: r.start, end: r.end });
    return map;
  });

  const update = (day: number, index: number, patch: Partial<Interval>) =>
    setWeek((w) => ({ ...w, [day]: w[day].map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  const add = (day: number) => setWeek((w) => ({ ...w, [day]: [...w[day], { start: "17:00", end: "21:00" }] }));
  const remove = (day: number, index: number) => setWeek((w) => ({ ...w, [day]: w[day].filter((_, i) => i !== index) }));
  const copyToWeekdays = (day: number) =>
    setWeek((w) => ({ ...w, 1: [...w[day]], 2: [...w[day]], 3: [...w[day]], 4: [...w[day]], 5: [...w[day]] }));

  const rules = Object.entries(week).flatMap(([day, intervals]) => intervals.map((it) => ({ weekday: Number(day), ...it })));

  return (
    <ActionForm action={saveAvailabilityAction} className="space-y-4">
      <input type="hidden" name="teacherId" value={teacherId} />
      <input type="hidden" name="rules" value={JSON.stringify(rules)} />
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <div key={day} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
            <div className="w-28 shrink-0 pt-2 text-sm font-semibold text-slate-800">{WEEKDAY_NAMES[day - 1]}</div>
            <div className="flex-1 space-y-2">
              {week[day].length === 0 ? <p className="pt-2 text-sm text-slate-400">Müsait değil</p> : null}
              {week[day].map((it, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input type="time" step={900} value={it.start} onChange={(e) => update(day, index, { start: e.target.value })} className="min-w-0 flex-1 sm:w-32 sm:flex-none" aria-label="Başlangıç" />
                  <span className="text-slate-400">–</span>
                  <Input type="time" step={900} value={it.end} onChange={(e) => update(day, index, { end: e.target.value })} className="min-w-0 flex-1 sm:w-32 sm:flex-none" aria-label="Bitiş" />
                  <button type="button" onClick={() => remove(day, index)} className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Aralığı sil">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <Button size="sm" variant="ghost" onClick={() => add(day)}>
                <Plus className="size-4" aria-hidden /> Aralık
              </Button>
              {day === 1 && week[1].length ? (
                <Button size="sm" variant="ghost" onClick={() => copyToWeekdays(1)} title="Pazartesi saatlerini hafta içine kopyala">
                  <Copy className="size-4" aria-hidden /> Hafta içine
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <input type="hidden" name="bufferMinutes" value={0} data-previous={bufferMinutes} />
      <p className="text-sm text-slate-500">Dersler tam saatte başlar (ör. 17:00, 18:00) ve 45 ya da 60 dakika sürer. Aralıkları tam saatlerle girmeniz yeterli; 45 dakikalık derslerden sonra 15 dakika mola kendiliğinden kalır.</p>
      <SubmitButton size="lg">Takvimi kaydet</SubmitButton>
    </ActionForm>
  );
}

export type ExceptionRow = { id: string; dateLabel: string; type: string; timeLabel: string; note: string | null };

export function ExceptionsEditor({ teacherId, exceptions, minDate }: { teacherId: string; exceptions: ExceptionRow[]; minDate: string }) {
  const [kind, setKind] = useState("BLOCKED_DAY");
  return (
    <div className="space-y-4">
      {exceptions.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {e.dateLabel} <Badge tone={e.type === "EXTRA" ? "green" : "rose"}>{e.type === "EXTRA" ? "Ek müsaitlik" : "Kapalı"}</Badge>
                </p>
                <p className="text-slate-500">
                  {e.timeLabel}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <form action={removeExceptionAction}>
                <input type="hidden" name="teacherId" value={teacherId} />
                <input type="hidden" name="exceptionId" value={e.id} />
                <button type="submit" className="rounded-md p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Sil">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Planlanmış izin veya ek saat yok.</p>
      )}
      <ActionForm action={addExceptionAction} resetOnSuccess className="grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <input type="hidden" name="teacherId" value={teacherId} />
        <Field label="Tarih">
          <Input type="date" name="date" min={minDate} required />
        </Field>
        <Field label="Tür">
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="BLOCKED_DAY">Bütün gün kapalı (izin/tatil)</option>
            <option value="BLOCKED">Belirli saatlerde kapalı</option>
            <option value="EXTRA">Ek müsait saat</option>
          </Select>
        </Field>
        {kind !== "BLOCKED_DAY" ? (
          <>
            <Field label="Başlangıç">
              <Input type="time" name="start" step={900} defaultValue="10:00" required />
            </Field>
            <Field label="Bitiş">
              <Input type="time" name="end" step={900} defaultValue="12:00" required />
            </Field>
          </>
        ) : null}
        <Field label="Not (isteğe bağlı)" className="sm:col-span-2">
          <Input name="note" maxLength={200} placeholder="Örn: Bayram tatili" />
        </Field>
        <div className="sm:col-span-2">
          <SubmitButton variant="secondary">Ekle</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

"use client";

import { useState } from "react";
import { saveAttendanceAction } from "@/actions/center/classes";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";

type Status = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const OPTIONS: { value: Status; label: string; active: string }[] = [
  { value: "PRESENT", label: "Geldi", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "ABSENT", label: "Gelmedi", active: "bg-rose-600 text-white border-rose-600" },
  { value: "LATE", label: "Geç", active: "bg-amber-500 text-white border-amber-500" },
  { value: "EXCUSED", label: "İzinli", active: "bg-sky-600 text-white border-sky-600" },
];

export type SheetStudent = { id: string; name: string; studentNumber: string | null; status: Status; note: string | null; notified: boolean };

export function AttendanceSheet({
  hidden,
  students,
  notifyAvailable,
}: {
  hidden: Record<string, string>;
  students: SheetStudent[];
  notifyAvailable: boolean;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, s.status])));
  const [notes, setNotes] = useState<Record<string, boolean>>(() => Object.fromEntries(students.map((s) => [s.id, Boolean(s.note)])));
  const counts = OPTIONS.map((o) => ({ ...o, count: Object.values(statuses).filter((s) => s === o.value).length }));
  return (
    <ActionForm action={saveAttendanceAction} className="space-y-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {counts.map((c) => (
            <span key={c.value} className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              {c.label}: {c.count}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.id, "PRESENT" as Status])))}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          Hepsini “Geldi” yap
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {students.map((s, index) => (
          <li key={s.id} className="px-4 py-3">
            <input type="hidden" name="studentIds" value={s.id} />
            <input type="hidden" name={`status:${s.id}`} value={statuses[s.id]} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  <span className="mr-2 text-xs font-normal text-slate-400">{index + 1}.</span>
                  {s.name}
                </p>
                <p className="text-xs text-slate-500">
                  {s.studentNumber ? `No ${s.studentNumber}` : ""}
                  {s.notified ? " · Veliye bildirildi" : ""}
                  <button type="button" className="ml-2 font-semibold text-slate-500 hover:text-brand-700" onClick={() => setNotes({ ...notes, [s.id]: !notes[s.id] })}>
                    {notes[s.id] ? "Notu gizle" : "Not ekle"}
                  </button>
                </p>
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={`${s.name} yoklama`}>
                {OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={statuses[s.id] === o.value}
                    onClick={() => setStatuses({ ...statuses, [s.id]: o.value })}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3",
                      statuses[s.id] === o.value ? o.active : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {notes[s.id] ? <Input name={`note:${s.id}`} defaultValue={s.note ?? ""} placeholder="Örn: Doktor raporu var" className="mt-2 h-9" /> : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {notifyAvailable ? (
          <Checkbox name="notify" defaultChecked label="Gelmeyen öğrencilerin velilerine SMS / e-posta / site bildirimi gönder (her öğrenci için bir kez)" />
        ) : (
          <p className="text-sm text-slate-500">Devamsızlık bildirimi kurum ayarlarında kapalı.</p>
        )}
        <SubmitButton size="lg">Yoklamayı kaydet</SubmitButton>
      </div>
    </ActionForm>
  );
}

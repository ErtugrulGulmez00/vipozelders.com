"use client";

import { Check, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  addPlanItemAction,
  assignResourceAction,
  copyPlanWeekAction,
  createResourceAction,
  deletePlanItemAction,
  deleteResourceAction,
  portalSaveProgressAction,
  portalTogglePlanItemAction,
  saveProgressAction,
  togglePlanItemAction,
  unassignResourceAction,
  updateResourceAction,
} from "@/actions/center/resources";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { normalizeSearch } from "@/lib/text";

type ResourceValues = { id: string; name: string; subject: string; publisher: string | null; topics: string[]; isActive: boolean };

/** Kaynak (kitap / soru bankası) ekleme ve düzenleme. Konular satır satır yazılır. */
export function ResourceForm({ initial }: { initial?: ResourceValues }) {
  return (
    <ActionForm action={initial ? updateResourceAction : createResourceAction} className="space-y-3">
      {initial ? <input type="hidden" name="resourceId" value={initial.id} /> : null}
      <Field label="Kaynak adı">
        <Input name="name" defaultValue={initial?.name} placeholder="Örn: 8. Sınıf Matematik Soru Bankası" required />
        <FieldError name="name" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ders">
          <Input name="subject" defaultValue={initial?.subject} placeholder="Matematik" required />
          <FieldError name="subject" />
        </Field>
        <Field label="Yayınevi (isteğe bağlı)">
          <Input name="publisher" defaultValue={initial?.publisher ?? ""} />
        </Field>
      </div>
      <Field label="Konular / üniteler" hint="Her satıra bir konu ya da test yazın. Öğrenci ilerlemesi bu konulara göre tutulur.">
        <Textarea name="topics" rows={8} defaultValue={initial?.topics.join("\n")} placeholder={"Çarpanlar ve Katlar\nÜslü İfadeler\nKareköklü İfadeler"} required />
        <FieldError name="topics" />
      </Field>
      {initial ? <Checkbox name="archived" defaultChecked={!initial.isActive} label="Arşivle (yeni atamalarda listelenmez)" /> : null}
      <SubmitButton>{initial ? "Kaydet" : "Kaynağı ekle"}</SubmitButton>
    </ActionForm>
  );
}

export function DeleteResourceButton({ resourceId }: { resourceId: string }) {
  return (
    <ActionForm action={deleteResourceAction}>
      <input type="hidden" name="resourceId" value={resourceId} />
      <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Kaynak ve öğrencilerin bu kaynaktaki ilerlemesi silinsin mi?">
        Kaynağı sil
      </SubmitButton>
    </ActionForm>
  );
}

/** Kaynağı sınıfa ya da seçilen öğrencilere atama. */
export function AssignResourceForm({ resourceId, groups, students }: { resourceId: string; groups: { id: string; name: string }[]; students: { id: string; name: string; groups: string }[] }) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());
  const visible = useMemo(() => {
    const q = normalizeSearch(filter);
    return q ? students.filter((s) => normalizeSearch(`${s.name} ${s.groups}`).includes(q)) : students;
  }, [filter, students]);
  return (
    <ActionForm action={assignResourceAction} className="space-y-3">
      <input type="hidden" name="resourceId" value={resourceId} />
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
      <SubmitButton>Kaynağı ata</SubmitButton>
    </ActionForm>
  );
}

export function UnassignResourceButton({ studentResourceId }: { studentResourceId: string }) {
  return (
    <ActionForm action={unassignResourceAction} hideMessages>
      <input type="hidden" name="studentResourceId" value={studentResourceId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-500" pendingText="…" confirmMessage="Kaynak bu öğrenciden kaldırılsın mı? İlerleme kayıtları da silinir.">
        Kaldır
      </SubmitButton>
    </ActionForm>
  );
}

export type ProgressRowValue = { topic: string; solved: number; correct: number; wrong: number; done: boolean };

/** Konu konu ilerleme girişi: çözülen, doğru, yanlış, bitti. Kurum personeli ve portal (öğrenci/veli) kullanır. */
export function ProgressForm({ studentResourceId, rows, portal }: { studentResourceId: string; rows: ProgressRowValue[]; portal?: boolean }) {
  return (
    <ActionForm action={portal ? portalSaveProgressAction : saveProgressAction} className="space-y-3">
      <input type="hidden" name="studentResourceId" value={studentResourceId} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1.5 pr-2 font-medium">Konu</th>
              <th className="w-20 px-1 font-medium">Çözülen</th>
              <th className="w-20 px-1 font-medium">Doğru</th>
              <th className="w-20 px-1 font-medium">Yanlış</th>
              <th className="w-14 px-1 text-center font-medium">Bitti</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.topic}>
                <td className="py-1.5 pr-2">
                  <input type="hidden" name="topics" value={r.topic} />
                  <span className={cn(r.done && "text-emerald-700")}>{r.topic}</span>
                </td>
                {(["solved", "correct", "wrong"] as const).map((k) => (
                  <td key={k} className="px-1">
                    <Input name={`${k}:${r.topic}`} type="number" min={0} defaultValue={r[k] || ""} className="h-8 px-2" aria-label={`${r.topic} ${k === "solved" ? "çözülen" : k === "correct" ? "doğru" : "yanlış"}`} />
                  </td>
                ))}
                <td className="px-1 text-center">
                  <input type="checkbox" name={`done:${r.topic}`} defaultChecked={r.done} className="size-4 accent-emerald-600" aria-label={`${r.topic} bitti`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SubmitButton size="sm">İlerlemeyi kaydet</SubmitButton>
    </ActionForm>
  );
}

/** Programa madde ekleme (kurum personeli). */
export function PlanItemForm({ studentId, resources, defaultDate, days }: { studentId: string; resources: { id: string; name: string; subject: string; topics: string[] }[]; defaultDate: string; days: { date: string; label: string }[] }) {
  const [resourceId, setResourceId] = useState("");
  const resource = resources.find((r) => r.id === resourceId);
  return (
    <ActionForm action={addPlanItemAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="studentId" value={studentId} />
      <Field label="Gün">
        <Select name="date" defaultValue={defaultDate}>
          {days.map((d) => (
            <option key={d.date} value={d.date}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kaynak (isteğe bağlı)">
        <Select name="resourceId" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
          <option value="">Kaynak yok</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.subject} · {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ders">
        <Input name="subject" defaultValue={resource?.subject ?? ""} key={resourceId} placeholder="Matematik" required />
        <FieldError name="subject" />
      </Field>
      <Field label="Konu (isteğe bağlı)">
        <Input name="topic" list={`topics-${studentId}`} placeholder="Örn: Üslü ifadeler test 3" />
        <datalist id={`topics-${studentId}`}>
          {(resource?.topics ?? []).map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field label="Hedef soru (isteğe bağlı)">
        <Input name="targetQuestions" type="number" min={0} max={2000} placeholder="40" />
      </Field>
      <Field label="Not (isteğe bağlı)">
        <Input name="note" maxLength={300} placeholder="Örn: Yanlışların çözümünü izle" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Programa ekle</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CopyWeekButton({ studentId, weekStart }: { studentId: string; weekStart: string }) {
  return (
    <ActionForm action={copyPlanWeekAction} hideMessages={false}>
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="weekStart" value={weekStart} />
      <SubmitButton size="sm" variant="outline" pendingText="Kopyalanıyor…">
        Bu haftayı sonraki haftaya kopyala
      </SubmitButton>
    </ActionForm>
  );
}

/** Program maddesi: tamamlandı düğmesi (personel ya da portal) ve personel için silme. */
export function PlanItemControls({ itemId, done, portal, canDelete }: { itemId: string; done: boolean; portal?: boolean; canDelete?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <ActionForm action={portal ? portalTogglePlanItemAction : togglePlanItemAction} hideMessages>
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="done" value={done ? "" : "on"} />
        <SubmitButton
          size="sm"
          variant={done ? "primary" : "outline"}
          className={cn("h-7 px-2 text-xs", done && "bg-emerald-600 hover:bg-emerald-700")}
          pendingText="…"
          aria-label={done ? "Tamamlanmadı yap" : "Tamamlandı işaretle"}
        >
          <Check className="size-3.5" aria-hidden /> {done ? "Yapıldı" : "Yaptım"}
        </SubmitButton>
      </ActionForm>
      {canDelete ? (
        <ActionForm action={deletePlanItemAction} hideMessages>
          <input type="hidden" name="itemId" value={itemId} />
          <SubmitButton size="sm" variant="ghost" className="h-7 px-1.5 text-slate-400 hover:text-rose-600" pendingText="…" aria-label="Sil">
            <Trash2 className="size-3.5" aria-hidden />
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}

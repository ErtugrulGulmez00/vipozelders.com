"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { removeOfferingAction, saveOfferingAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { durationLabel } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { Catalog } from "@/server/catalog";

export type OfferingRow = {
  id: string;
  serviceTypeId: number;
  levelId: number;
  subjectId: number;
  hourlyPrice: number;
  durations: number[];
  questionPrice: number | null;
  isActive: boolean;
  label: string;
};

const DURATIONS = [45, 60];

function Earnings({ priceTl, commissionBps }: { priceTl: number; commissionBps: number }) {
  if (!priceTl || priceTl <= 0) return null;
  const gross = Math.round(priceTl * 100);
  const net = gross - Math.round((gross * commissionBps) / 10000);
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-emerald-50 p-3 text-sm">
      <div>
        <p className="text-xs text-slate-500">Öğrencinin ödeyeceği (60 dk)</p>
        <p className="font-bold text-slate-900">{formatMoney(gross)}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Sizin kazancınız (%{commissionBps / 100} hizmet bedeli sonrası)</p>
        <p className="font-bold text-emerald-700">{formatMoney(net)}</p>
      </div>
    </div>
  );
}

function OfferingForm({
  teacherId,
  catalog,
  commissionBps,
  initial,
  onDone,
}: {
  teacherId: string;
  catalog: Catalog;
  commissionBps: number;
  initial?: OfferingRow;
  onDone?: () => void;
}) {
  const [levelId, setLevelId] = useState(initial?.levelId ?? catalog.levels[0]?.id);
  const [price, setPrice] = useState(initial ? initial.hourlyPrice / 100 : 0);
  const [serviceId, setServiceId] = useState(initial?.serviceTypeId ?? catalog.services[0]?.id);
  const isQuestionService = catalog.services.find((s) => s.id === serviceId)?.slug === "soru-cozum";
  const level = catalog.levels.find((l) => l.id === levelId);
  const subjects = catalog.subjects.filter((s) => level?.subjectIds.includes(s.id));

  return (
    <ActionForm
      action={async (state, formData) => {
        const result = await saveOfferingAction(state, formData);
        if (result.ok) onDone?.();
        return result;
      }}
      resetOnSuccess={!initial}
      className="space-y-4"
    >
      <input type="hidden" name="teacherId" value={teacherId} />
      {initial ? <input type="hidden" name="offeringId" value={initial.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Hizmet">
          <Select name="serviceTypeId" value={serviceId} onChange={(e) => setServiceId(Number(e.target.value))}>
            {catalog.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kademe">
          <Select name="levelId" value={levelId} onChange={(e) => setLevelId(Number(e.target.value))}>
            {catalog.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ders">
          <Select name="subjectId" defaultValue={initial?.subjectId} key={levelId}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Field label="Saatlik ücret (₺, KDV dahil)">
          <Input name="hourlyPrice" type="number" min={100} max={20000} step={10} defaultValue={initial ? initial.hourlyPrice / 100 : ""} onChange={(e) => setPrice(Number(e.target.value))} required />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Ders süreleri</legend>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((d) => (
              <label key={d} className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 has-checked:bg-brand-600 has-checked:text-white has-checked:ring-brand-600">
                <input type="checkbox" name="durations" value={d} defaultChecked={initial ? initial.durations.includes(d) : true} className="sr-only" />
                {durationLabel(d)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <Earnings priceTl={price} commissionBps={commissionBps} />
      {isQuestionService ? (
        <Field label="Fotoğrafla soru ücreti (₺ / soru, KDV dahil)" hint="Öğrenci sorunun fotoğrafını gönderir, siz yazılı, fotoğraflı ya da videolu çözümü panelden yollarsınız. Boş bırakırsanız yalnızca görüntülü soru çözüm dersi alınabilir.">
          <Input name="questionPrice" type="number" min={20} max={5000} step={5} defaultValue={initial?.questionPrice ? initial.questionPrice / 100 : ""} className="sm:w-48" />
        </Field>
      ) : null}
      <div className="flex gap-2">
        <SubmitButton>{initial ? "Güncelle" : "Dersi ekle"}</SubmitButton>
        {onDone && initial ? (
          <Button variant="ghost" onClick={onDone}>
            <X className="size-4" aria-hidden /> Vazgeç
          </Button>
        ) : null}
      </div>
    </ActionForm>
  );
}

export function OfferingsEditor({
  teacherId,
  catalog,
  offerings,
  commissionBps,
}: {
  teacherId: string;
  catalog: Catalog;
  offerings: OfferingRow[];
  commissionBps: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(offerings.length === 0);

  return (
    <div className="space-y-4">
      {offerings.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {offerings.map((o) => (
            <li key={o.id} className="p-4">
              {editing === o.id ? (
                <OfferingForm teacherId={teacherId} catalog={catalog} commissionBps={commissionBps} initial={o} onDone={() => setEditing(null)} />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {o.label} {o.isActive ? null : <Badge tone="slate">Pasif</Badge>}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatMoney(o.hourlyPrice)} / saat · {o.durations.map(durationLabel).join(", ")}
                      {o.questionPrice ? ` · fotoğrafla soru ${formatMoney(o.questionPrice)}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(o.id)}>
                      <Pencil className="size-4" aria-hidden /> Düzenle
                    </Button>
                    <ActionForm action={removeOfferingAction} hideMessages>
                      <input type="hidden" name="teacherId" value={teacherId} />
                      <input type="hidden" name="offeringId" value={o.id} />
                      <SubmitButton variant="ghost" size="sm" className="text-rose-600" confirmMessage="Bu dersi kaldırmak istiyor musunuz?" pendingText="…">
                        <Trash2 className="size-4" aria-hidden />
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {adding ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
          <p className="mb-3 font-semibold text-slate-900">Yeni ders ekle</p>
          <OfferingForm teacherId={teacherId} catalog={catalog} commissionBps={commissionBps} />
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Ders ekle
        </Button>
      )}
    </div>
  );
}

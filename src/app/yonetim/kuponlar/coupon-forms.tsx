"use client";

import { useState } from "react";
import { createCouponAction, toggleCouponAction } from "@/actions/coupons";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

const TARGETS = [
  ["booking", "Birebir ders"],
  ["credits", "Soru kredisi"],
  ["subscription", "Soru aboneliği"],
  ["group", "Grup dersi"],
];

export function CreateCouponForm() {
  const [kind, setKind] = useState("PERCENT");
  return (
    <ActionForm action={createCouponAction} className="grid gap-4 sm:grid-cols-3" resetOnSuccess>
      <Field label="Kod">
        <Input name="code" required placeholder="LGS2027" className="uppercase" />
        <FieldError name="code" />
      </Field>
      <Field label="Tür">
        <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="PERCENT">Yüzde (%)</option>
          <option value="AMOUNT">Tutar (₺)</option>
        </Select>
      </Field>
      <Field label={kind === "PERCENT" ? "İndirim (%)" : "İndirim (₺)"}>
        <Input name="value" required inputMode="decimal" placeholder={kind === "PERCENT" ? "10" : "100"} />
        <FieldError name="value" />
      </Field>
      {kind === "PERCENT" ? (
        <Field label="En fazla indirim (₺, isteğe bağlı)">
          <Input name="maxDiscount" inputMode="decimal" />
        </Field>
      ) : null}
      <Field label="En az sepet (₺, isteğe bağlı)">
        <Input name="minAmount" inputMode="decimal" />
      </Field>
      <Field label="Açıklama (yalnızca yönetim)">
        <Input name="description" maxLength={200} placeholder="Örn: Instagram kampanyası" />
      </Field>
      <Field label="Toplam kullanım sınırı (boş: sınırsız)">
        <Input name="maxUses" type="number" min={1} />
      </Field>
      <Field label="Kişi başı kullanım">
        <Input name="perUserLimit" type="number" min={1} defaultValue={1} />
      </Field>
      <Field label="Başlangıç (isteğe bağlı)">
        <Input name="startsAt" type="date" />
      </Field>
      <Field label="Bitiş (isteğe bağlı)">
        <Input name="endsAt" type="date" />
      </Field>
      <div className="sm:col-span-3">
        <p className="mb-1.5 text-sm font-medium text-slate-700">Geçerli olduğu satışlar</p>
        <div className="flex flex-wrap gap-4">
          {TARGETS.map(([value, label]) => (
            <Checkbox key={value} name="targets" value={value} defaultChecked label={label} />
          ))}
        </div>
      </div>
      <div className="sm:col-span-3">
        <Checkbox name="firstOrderOnly" label="Yalnızca ilk siparişte geçerli" />
      </div>
      <p className="text-xs text-slate-500 sm:col-span-3">İndirim platformun hizmet bedelinden karşılanır; öğretmen payı değişmez. Bu yüzden derslerde indirim en fazla hizmet bedeli kadar olur.</p>
      <div className="sm:col-span-3">
        <SubmitButton>Kodu oluştur</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ToggleCouponForm({ id, active }: { id: string; active: boolean }) {
  return (
    <ActionForm action={toggleCouponAction} hideMessages>
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="outline" pendingText="…">
        {active ? "Durdur" : "Aç"}
      </SubmitButton>
    </ActionForm>
  );
}

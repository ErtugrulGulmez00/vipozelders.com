"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cancelPaymentAction, createExpenseAction, deleteExpenseAction, recordPaymentAction, remindOverdueAction } from "@/actions/center/finance";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/center/labels";
import { formatMoney } from "@/lib/money";
import { normalizeSearch } from "@/lib/text";

export function StudentPicker({ students, selectedId, basePath }: { students: { id: string; name: string; meta: string }[]; selectedId: string | null; basePath: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return [];
    return students.filter((s) => normalizeSearch(`${s.name} ${s.meta}`).includes(q)).slice(0, 8);
  }, [query, students]);
  return (
    <div className="relative">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Öğrenci adı ya da numarası yazın…" aria-label="Öğrenci ara" autoComplete="off" />
      {matches.length ? (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  router.push(`${basePath}?ogrenci=${s.id}`);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${s.id === selectedId ? "bg-brand-50" : ""}`}
              >
                <span className="font-medium text-slate-900">{s.name}</span>
                <span className="text-xs text-slate-500">{s.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PaymentForm({ studentId, suggested, payerName, today, guardiansReachable }: { studentId: string; suggested: number; payerName: string | null; today: string; guardiansReachable: boolean }) {
  return (
    <ActionForm action={recordPaymentAction} className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tutar (TL)">
          <Input name="amount" inputMode="decimal" defaultValue={suggested ? String(suggested / 100).replace(".", ",") : ""} required autoFocus />
          <FieldError name="amount" />
        </Field>
        <Field label="Ödeme şekli">
          <Select name="method" defaultValue="CASH">
            {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tarih">
          <Input name="paidAt" type="date" defaultValue={today} max={today} required />
        </Field>
        <Field label="Ödeyen">
          <Input name="payerName" defaultValue={payerName ?? ""} />
        </Field>
        <Field label="Açıklama" className="sm:col-span-2">
          <Input name="note" placeholder="Örn: Ekim taksiti, kitap ücreti" />
        </Field>
      </div>
      {guardiansReachable ? <Checkbox name="notify" defaultChecked label="Veliye ödeme bilgisi (WhatsApp) gönder" /> : null}
      <SubmitButton size="lg">Tahsilatı kaydet ve makbuz oluştur</SubmitButton>
    </ActionForm>
  );
}

export function CancelPaymentForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-rose-600 hover:underline print:hidden">
        Tahsilatı iptal et
      </button>
    );
  }
  return (
    <ActionForm action={cancelPaymentAction} className="flex flex-wrap items-start gap-2 print:hidden">
      <input type="hidden" name="paymentId" value={paymentId} />
      <div>
        <Input name="reason" placeholder="İptal sebebi" className="h-9 w-64" required />
        <FieldError name="reason" />
      </div>
      <SubmitButton size="sm" variant="danger" pendingText="…" confirmMessage="Tahsilat iptal edilsin mi? Makbuz numarası korunur, tutar borca geri eklenir.">
        İptal et
      </SubmitButton>
    </ActionForm>
  );
}

export function OverdueReminderForm({ rows }: { rows: { studentId: string; name: string; amount: number; installments: number; oldestDue: string; guardian: string; phone: string | null; lastReminded: string | null; meta: string }[] }) {
  const [selected, setSelected] = useState(() => new Set(rows.map((r) => r.studentId)));
  const all = selected.size === rows.length;
  return (
    <ActionForm action={remindOverdueAction} className="space-y-4">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="studentIds" value={id} />
      ))}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">
                <input type="checkbox" checked={all} onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.studentId)))} className="size-4 accent-brand-600" aria-label="Tümünü seç" />
              </th>
              <th className="px-4 py-2.5">Öğrenci</th>
              <th className="px-4 py-2.5">Veli</th>
              <th className="px-4 py-2.5">En eski vade</th>
              <th className="px-4 py-2.5 text-right">Geciken</th>
              <th className="px-4 py-2.5">Son hatırlatma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(r.studentId)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(r.studentId);
                      else next.delete(r.studentId);
                      setSelected(next);
                    }}
                    className="size-4 accent-brand-600"
                    aria-label={`${r.name} seç`}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <a href={`/kurum/ogrenciler/${r.studentId}?sekme=odemeler`} className="font-semibold text-brand-700 hover:underline">
                    {r.name}
                  </a>
                  <p className="text-xs text-slate-500">{r.meta}</p>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {r.guardian}
                  {r.phone ? (
                    <p>
                      <a href={`tel:${r.phone}`} className="text-slate-500 hover:underline">
                        {r.phone}
                      </a>
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {r.oldestDue}
                  <p className="text-slate-500">{r.installments} taksit</p>
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-rose-600">{formatMoney(r.amount)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{r.lastReminded ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Hatırlatma velilere WhatsApp ve site/uygulama bildirimiyle gider.</p>
        <SubmitButton disabled={!selected.size} confirmMessage={`${selected.size} öğrencinin velisine hatırlatma gönderilsin mi?`}>
          Seçilenlere hatırlatma gönder ({selected.size})
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ExpenseForm({ members, today }: { members: { id: string; name: string }[]; today: string }) {
  const [category, setCategory] = useState("RENT");
  return (
    <ActionForm action={createExpenseAction} resetOnSuccess className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Gider türü">
          <Select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(EXPENSE_CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tutar (TL)">
          <Input name="amount" inputMode="decimal" required />
          <FieldError name="amount" />
        </Field>
        <Field label="Tarih">
          <Input name="date" type="date" defaultValue={today} required />
        </Field>
        {category === "SALARY" ? (
          <Field label="Personel">
            <Select name="memberId" defaultValue="">
              <option value="">Seçin</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Ödenen kişi / firma">
            <Input name="paidTo" />
          </Field>
        )}
        <Field label="Açıklama" className="sm:col-span-2">
          <Input name="description" placeholder="Örn: Ekim kirası" />
        </Field>
      </div>
      <SubmitButton size="sm">Gideri kaydet</SubmitButton>
    </ActionForm>
  );
}

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  return (
    <ActionForm action={deleteExpenseAction} hideMessages>
      <input type="hidden" name="expenseId" value={expenseId} />
      <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600" pendingText="…" confirmMessage="Gider silinsin mi?">
        Sil
      </SubmitButton>
    </ActionForm>
  );
}

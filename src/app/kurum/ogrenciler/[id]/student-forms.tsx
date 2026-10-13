"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cancelFeePlanAction, createFeePlanAction, updateInstallmentAction } from "@/actions/center/finance";
import {
  addNoteAction,
  deleteGuardianAction,
  deleteNoteAction,
  deleteStudentAction,
  inviteGuardianAction,
  messageStudentGuardiansAction,
  saveGuardianAction,
  setStudentStatusAction,
} from "@/actions/center/students";
import { createStudentAccountAction, removeStudentAccountAction, resetStudentAccountAction } from "@/actions/center/questions";
import { CredentialsBox, InviteLinkBox } from "@/components/center/center-client";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { buildInstallments } from "@/lib/center/finance";
import { GUARDIAN_RELATIONS, NOTE_KIND_LABEL } from "@/lib/center/labels";
import { formatMoney, parseMoneyInput } from "@/lib/money";

export type GuardianView = {
  id: string;
  fullName: string;
  relation: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  notifySms: boolean;
  notifyEmail: boolean;
  linked: boolean;
  inviteExpiresAt: string | null;
};

function GuardianFields({ guardian }: { guardian?: GuardianView }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="prefs" value="1" />
      <Field label="Ad soyad">
        <Input name="fullName" defaultValue={guardian?.fullName} required />
        <FieldError name="fullName" />
      </Field>
      <Field label="Yakınlık">
        <Select name="relation" defaultValue={guardian?.relation ?? "Anne"}>
          {[...new Set([...(guardian ? [guardian.relation] : []), ...GUARDIAN_RELATIONS])].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </Field>
      <Field label="Cep telefonu">
        <Input name="phone" type="tel" defaultValue={guardian?.phone ?? ""} placeholder="05XX XXX XX XX" />
        <FieldError name="phone" />
      </Field>
      <Field label="E-posta">
        <Input name="email" type="email" defaultValue={guardian?.email ?? ""} />
        <FieldError name="email" />
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <Checkbox name="notifySms" defaultChecked={guardian?.notifySms ?? true} label="SMS bildirimleri" />
        <Checkbox name="notifyEmail" defaultChecked={guardian?.notifyEmail ?? true} label="E-posta bildirimleri" />
        <Checkbox name="isPrimary" defaultChecked={guardian?.isPrimary} label="Birincil veli (listelerde görünen)" />
      </div>
    </div>
  );
}

export function GuardianCard({ studentId, guardian, canEdit }: { studentId: string; guardian: GuardianView; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">
            {guardian.fullName} <span className="text-sm font-normal text-slate-500">· {guardian.relation}</span>
            {guardian.isPrimary ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Birincil</span> : null}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {guardian.phone ? (
              <a href={`tel:${guardian.phone}`} className="hover:underline">
                {guardian.phone}
              </a>
            ) : (
              "Telefon yok"
            )}
            {guardian.email ? ` · ${guardian.email}` : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {guardian.notifySms ? "SMS açık" : "SMS kapalı"} · {guardian.notifyEmail ? "E-posta açık" : "E-posta kapalı"} ·{" "}
            {guardian.linked ? <span className="font-semibold text-brand-700">Veli portalına bağlı</span> : guardian.inviteExpiresAt ? "Davet gönderildi" : "Portala bağlı değil"}
          </p>
        </div>
        {canEdit ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              <Pencil className="size-3.5" aria-hidden /> Düzenle
            </button>
            <ActionForm action={deleteGuardianAction}>
              <input type="hidden" name="guardianId" value={guardian.id} />
              <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-rose-600" pendingText="…" confirmMessage={`${guardian.fullName} silinsin mi?`}>
                <Trash2 className="size-3.5" aria-hidden /> Sil
              </SubmitButton>
            </ActionForm>
          </div>
        ) : null}
      </div>
      {editing ? (
        <ActionForm action={saveGuardianAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="guardianId" value={guardian.id} />
          <GuardianFields guardian={guardian} />
          <SubmitButton size="sm">Kaydet</SubmitButton>
        </ActionForm>
      ) : null}
      {canEdit && !guardian.linked ? (
        <ActionForm action={inviteGuardianAction} className="mt-3 border-t border-slate-100 pt-3">
          <input type="hidden" name="guardianId" value={guardian.id} />
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton size="sm" variant="secondary" name="send" value="1" pendingText="Hazırlanıyor…" disabled={!guardian.phone && !guardian.email}>
              Veli portalı daveti gönder
            </SubmitButton>
            <SubmitButton size="sm" variant="ghost" pendingText="…">
              Yalnızca bağlantı oluştur
            </SubmitButton>
          </div>
          <InviteLinkBox />
        </ActionForm>
      ) : null}
    </div>
  );
}

export function AddGuardianForm({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-brand-700 hover:underline">
        + Veli ekle
      </button>
    );
  }
  return (
    <ActionForm action={saveGuardianAction} resetOnSuccess className="space-y-3 rounded-xl border border-dashed border-slate-300 p-4">
      <input type="hidden" name="studentId" value={studentId} />
      <GuardianFields />
      <SubmitButton size="sm">Veliyi ekle</SubmitButton>
    </ActionForm>
  );
}

export function StatusForm({ studentId, status }: { studentId: string; status: string }) {
  return (
    <ActionForm action={setStudentStatusAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="studentId" value={studentId} />
      <Select name="status" defaultValue={status} className="h-8 w-36" aria-label="Öğrenci durumu">
        <option value="ACTIVE">Aktif</option>
        <option value="PASSIVE">Pasif (dondurdu)</option>
        <option value="LEFT">Ayrıldı</option>
      </Select>
      <SubmitButton size="sm" variant="outline" pendingText="…">
        Durumu kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function DeleteStudentForm({ studentId, name }: { studentId: string; name: string }) {
  return (
    <ActionForm action={deleteStudentAction}>
      <input type="hidden" name="studentId" value={studentId} />
      <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="Siliniyor…" confirmMessage={`${name} ve tüm kayıtları (yoklama, deneme, notlar) kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`}>
        <Trash2 className="size-4" aria-hidden /> Öğrenciyi sil
      </SubmitButton>
    </ActionForm>
  );
}

export function NoteForm({ studentId }: { studentId: string }) {
  return (
    <ActionForm action={addNoteAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Select name="kind" aria-label="Not türü">
          {Object.entries(NOTE_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Textarea name="text" rows={2} placeholder="Görüşme notu, gözlem, yönlendirme…" required />
      </div>
      <FieldError name="text" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Checkbox name="visibleToParent" label="Veli portalında görünsün" />
        <SubmitButton size="sm">Notu ekle</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteNoteButton({ noteId }: { noteId: string }) {
  return (
    <ActionForm action={deleteNoteAction} hideMessages>
      <input type="hidden" name="noteId" value={noteId} />
      <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" pendingText="…" confirmMessage="Not silinsin mi?">
        Sil
      </SubmitButton>
    </ActionForm>
  );
}

export function GuardianMessageForm({ studentId }: { studentId: string }) {
  return (
    <ActionForm action={messageStudentGuardiansAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="studentId" value={studentId} />
      <Textarea name="text" rows={3} maxLength={600} placeholder="Örn: Yarınki veli toplantımıza bekliyoruz." required />
      <FieldError name="text" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-4">
          <Checkbox name="sms" defaultChecked label="SMS" />
          <Checkbox name="email" defaultChecked label="E-posta" />
        </div>
        <SubmitButton size="sm">Gönder</SubmitButton>
      </div>
    </ActionForm>
  );
}

function addMonthsPreview(first: string, count: number) {
  return first ? `${count} taksit, ilki ${first.split("-").reverse().join(".")}` : `${count} taksit`;
}

export function FeePlanForm({ studentId, academicYear, today }: { studentId: string; academicYear: string; today: string }) {
  const [total, setTotal] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [down, setDown] = useState("");
  const [count, setCount] = useState("9");
  const [first, setFirst] = useState(today);
  const preview = useMemo(() => {
    const totalAmount = parseMoneyInput(total) ?? 0;
    const percent = Number(discountPercent) || 0;
    const discountAmount = percent ? Math.round((totalAmount * percent) / 100) : (parseMoneyInput(discount) ?? 0);
    const net = Math.max(0, totalAmount - discountAmount);
    const downPayment = Math.min(parseMoneyInput(down) ?? 0, net);
    if (!net || !first) return null;
    return { net, rows: buildInstallments({ netAmount: net, count: Math.max(1, Math.min(36, Number(count) || 1)), firstDueDate: first, downPayment, downPaymentDate: today }) };
  }, [total, discount, discountPercent, down, count, first, today]);
  return (
    <ActionForm action={createFeePlanAction} resetOnSuccess className="space-y-4">
      <input type="hidden" name="studentId" value={studentId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Plan adı" className="sm:col-span-2 lg:col-span-3">
          <Input name="title" defaultValue={`${academicYear} eğitim ücreti`} required />
        </Field>
        <Field label="Toplam ücret (TL)">
          <Input name="totalAmount" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Örn: 45.000" required />
          <FieldError name="totalAmount" />
        </Field>
        <Field label="İndirim (TL)">
          <Input name="discountAmount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" disabled={Boolean(discountPercent)} />
          <FieldError name="discountAmount" />
        </Field>
        <Field label="ya da indirim (%)">
          <Input name="discountPercent" type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} placeholder="Örn: 10" />
        </Field>
        <Field label="Peşinat (TL)" hint="Bugün tarihli ilk ödeme">
          <Input name="downPayment" inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} placeholder="0" />
          <input type="hidden" name="downPaymentDate" value={today} />
          <FieldError name="downPayment" />
        </Field>
        <Field label="Taksit sayısı">
          <Input name="count" type="number" min={1} max={36} value={count} onChange={(e) => setCount(e.target.value)} required />
        </Field>
        <Field label="İlk taksit tarihi">
          <Input name="firstDueDate" type="date" value={first} onChange={(e) => setFirst(e.target.value)} required />
        </Field>
        <Field label="Not" className="sm:col-span-2 lg:col-span-3">
          <Input name="note" placeholder="Örn: Kardeş indirimi uygulandı" />
        </Field>
      </div>
      {preview ? (
        <div className="rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-slate-800">
            Net {formatMoney(preview.net)} · {addMonthsPreview(first, Number(count) || 1)}
          </p>
          <p className="mt-1 text-slate-600">
            {preview.rows.slice(0, 4).map((r) => `${r.dueDate.split("-").reverse().join(".")}: ${formatMoney(r.amount)}`).join(" · ")}
            {preview.rows.length > 4 ? " …" : ""}
          </p>
        </div>
      ) : null}
      <SubmitButton>Ödeme planını oluştur</SubmitButton>
    </ActionForm>
  );
}

export function InstallmentEditForm({ installmentId, dueDate, amount }: { installmentId: string; dueDate: string; amount: number }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-slate-500 hover:text-brand-700" aria-label="Taksiti düzenle">
        <Pencil className="size-3.5" aria-hidden />
      </button>
    );
  }
  return (
    <ActionForm action={updateInstallmentAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="installmentId" value={installmentId} />
      <Input name="dueDate" type="date" defaultValue={dueDate} className="h-8 w-40" />
      <Input name="amount" inputMode="decimal" defaultValue={String(amount / 100).replace(".", ",")} className="h-8 w-28" />
      <SubmitButton size="sm" pendingText="…">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function CancelPlanForm({ planId }: { planId: string }) {
  return (
    <ActionForm action={cancelFeePlanAction} hideMessages>
      <input type="hidden" name="planId" value={planId} />
      <SubmitButton size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-600" pendingText="…" confirmMessage="Ödeme planı iptal edilsin mi? Yapılan tahsilatlar durur, kalan taksitler borç sayılmaz.">
        Planı iptal et
      </SubmitButton>
    </ActionForm>
  );
}

export function StudentAccountCard({ studentId, account }: { studentId: string; account: { username: string | null; lastLoginAt: string | null } | null }) {
  return (
    <div className="space-y-3">
      {account ? (
        <>
          <p className="text-sm text-slate-700">
            Kullanıcı adı: <span className="font-mono font-semibold">{account.username}</span>
            <span className="block text-xs text-slate-500">{account.lastLoginAt ? `Son giriş ${account.lastLoginAt}` : "Henüz giriş yapmadı"} · Giriş adresi: sitenin “Giriş yap” sayfası</span>
          </p>
          <ActionForm action={resetStudentAccountAction} className="space-y-2">
            <CredentialsBox who="Öğrenci" />
            <input type="hidden" name="studentId" value={studentId} />
            <div className="flex flex-wrap gap-2">
              <SubmitButton size="sm" variant="outline" confirmMessage="Öğrenciye yeni geçici şifre oluşturulsun mu?">
                Şifreyi sıfırla
              </SubmitButton>
            </div>
          </ActionForm>
          <ActionForm action={removeStudentAccountAction}>
            <input type="hidden" name="studentId" value={studentId} />
            <SubmitButton size="sm" variant="ghost" className="text-rose-600" pendingText="…" confirmMessage="Öğrencinin giriş hesabı kaldırılsın mı?">
              Hesabı kaldır
            </SubmitButton>
          </ActionForm>
        </>
      ) : (
        <ActionForm action={createStudentAccountAction} className="space-y-2">
          <CredentialsBox who="Öğrenci" />
          <p className="text-sm text-slate-600">Öğrenci kendi hesabıyla devamsızlığını, ödevlerini, deneme sonuçlarını görür ve öğretmene fotoğrafla soru gönderir.</p>
          <input type="hidden" name="studentId" value={studentId} />
          <SubmitButton size="sm" variant="secondary">
            Öğrenci giriş hesabı aç
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

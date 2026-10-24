"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { adminCancelGroupCourseAction, cancelEnrollmentAction, cancelGroupCourseAction, createGroupCourseAction, enrollInGroupAction, inviteToGroupAction } from "@/actions/groups";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { CardLogos } from "@/components/site/card-logos";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { WEEKDAY_SHORT } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Limits = { minParticipants: number; maxCapacity: number; minPriceTl: number; maxPriceTl: number; commissionBps: number };

/** Öğretmen: grup dersi programı. Oturum sayısı ve tahmini kazanç anlık gösterilir. */
export function CreateCourseForm({ pairs, limits, today }: { pairs: { value: string; label: string }[]; limits: Limits; today: string }) {
  const [days, setDays] = useState<number[]>([2, 4]);
  const [weeks, setWeeks] = useState(4);
  const [price, setPrice] = useState(1000);
  const [capacity, setCapacity] = useState(limits.maxCapacity);
  const [minimum, setMinimum] = useState(limits.minParticipants);
  const sessions = days.length * weeks;
  const net = useMemo(() => Math.round(price * 100 * (1 - limits.commissionBps / 10_000)), [price, limits.commissionBps]);
  const toggle = (d: number) => setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));

  return (
    <ActionForm action={createGroupCourseAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Kademe ve ders" htmlFor="pair" className="sm:col-span-2">
        <Select id="pair" name="pair" required defaultValue="">
          <option value="" disabled>
            Seçin
          </option>
          {pairs.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <FieldError name="pair" />
      </Field>
      <Field label="Başlık" className="sm:col-span-2">
        <Input name="title" required maxLength={120} placeholder="Örn: LGS Matematik Kampı · Üslü ve köklü ifadeler" />
      </Field>
      <Field label="Açıklama (isteğe bağlı)" className="sm:col-span-2" hint="Neler işleneceğini, kimler için uygun olduğunu yazın. İletişim bilgileri gizlenir.">
        <Textarea name="description" rows={3} maxLength={2000} />
      </Field>

      <Field label="İlk ders günü">
        <Input name="firstDate" type="date" min={today} required />
        <FieldError name="firstDate" />
      </Field>
      <Field label="Ders saati">
        <Input name="startTime" type="time" step={900} defaultValue="19:00" required />
        <FieldError name="startTime" />
      </Field>
      <div className="sm:col-span-2">
        <p className="mb-1.5 text-sm font-medium text-slate-700">Haftanın günleri</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((label, i) => (
            <label key={label} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${days.includes(i + 1) ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 text-slate-600"}`}>
              <input type="checkbox" name="weekdays" value={i + 1} checked={days.includes(i + 1)} onChange={() => toggle(i + 1)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </div>
      <Field label="Oturum süresi">
        <Select name="durationMinutes" defaultValue="60">
          {[40, 45, 50, 60, 75, 90, 120].map((m) => (
            <option key={m} value={m}>
              {m} dakika
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kaç hafta">
        <Input name="weeks" type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Number(e.target.value) || 1)} required />
      </Field>

      <Field label="Kişi başı ücret (tüm program, ₺)" hint={`${limits.minPriceTl.toLocaleString("tr-TR")} – ${limits.maxPriceTl.toLocaleString("tr-TR")} ₺, KDV dahil`}>
        <Input name="priceTl" inputMode="numeric" value={price} onChange={(e) => setPrice(Number(e.target.value.replace(/\D/g, "")) || 0)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kontenjan">
          <Input name="capacity" type="number" min={limits.minParticipants} max={limits.maxCapacity} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required />
        </Field>
        <Field label="En az kişi">
          <Input name="minParticipants" type="number" min={limits.minParticipants} max={capacity} value={minimum} onChange={(e) => setMinimum(Number(e.target.value))} required />
        </Field>
      </div>
      <Field label="Kayıt bitiş günü" hint="İlk dersten önce olmalı. Bu tarihte en az kişi sayısı dolmazsa ders iptal olur, herkese tam iade yapılır.">
        <Input name="deadlineDate" type="date" min={today} required />
        <FieldError name="deadlineDate" />
      </Field>
      <Field label="Kayıt bitiş saati">
        <Input name="deadlineTime" type="time" step={900} defaultValue="20:00" />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox name="isPublic" defaultChecked label="Sitedeki “Grup dersleri” listesinde yayınla (kapalıysa yalnızca davet ettiğiniz öğrenciler katılabilir)" />
      </div>

      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 sm:col-span-2">
        <p>
          <strong>{sessions}</strong> oturum · kişi başı {formatMoney(price * 100)} · hizmet bedeli %{(limits.commissionBps / 100).toLocaleString("tr-TR")} · size kalan kişi başı <strong>{formatMoney(net)}</strong>
        </p>
        <p className="mt-1">
          {minimum} kişiyle {formatMoney(net * minimum)}, {capacity} kişiyle {formatMoney(net * capacity)} kazanırsınız. Ödeme her oturum yapıldıkça o oturumun payı kadar serbest kalır.
        </p>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton size="lg" pendingText="Program oluşturuluyor…" disabled={!days.length}>
          Grup dersini oluştur
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function InviteForm({ courseId }: { courseId: string }) {
  return (
    <ActionForm action={inviteToGroupAction} className="flex flex-wrap items-end gap-2" resetOnSuccess>
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Öğrencinin (velinin) e-posta adresi" className="min-w-56 flex-1" hint="Sitede üye olmalı. Daveti kabul edip ödeme yapınca listenize eklenir.">
        <Input name="email" type="email" required placeholder="veli@ornek.com" />
        <FieldError name="email" />
      </Field>
      <SubmitButton pendingText="Gönderiliyor…">Davet et</SubmitButton>
    </ActionForm>
  );
}

export function CancelCourseForm({ courseId, admin = false }: { courseId: string; admin?: boolean }) {
  return (
    <ActionForm action={admin ? adminCancelGroupCourseAction : cancelGroupCourseAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="İptal gerekçesi" className="min-w-56 flex-1">
        <Input name="reason" required placeholder="Örn: Sağlık sorunu nedeniyle" />
        <FieldError name="reason" />
      </Field>
      <SubmitButton variant="danger" pendingText="İptal ediliyor…" confirmMessage="Ders iptal edilsin ve ödeme yapanlara iade yapılsın mı?">
        Dersi iptal et
      </SubmitButton>
    </ActionForm>
  );
}

export function EnrollForm({ courseId, label, defaultName }: { courseId: string; label: string; defaultName: string }) {
  return (
    <ActionForm action={enrollInGroupAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="Ders kimin için?" hint="Öğretmen öğrenci listesinde bu adı görür.">
        <Input name="learnerName" required maxLength={80} defaultValue={defaultName} />
        <FieldError name="learnerName" />
      </Field>
      <div className="rounded-xl border border-slate-200 p-4">
        <Checkbox
          name="consent"
          required
          label={
            <>
              <Link href="/sayfa/on-bilgilendirme-formu" target="_blank" className="font-medium text-brand-700 underline">
                Ön Bilgilendirme Formu
              </Link>{" "}
              ile{" "}
              <Link href="/sayfa/mesafeli-satis-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
                Mesafeli Satış Sözleşmesi
              </Link>
              ’ni okudum ve onaylıyorum. İptal ve iade koşulları:{" "}
              <Link href="/sayfa/iptal-ve-iade-politikasi" target="_blank" className="font-medium text-brand-700 underline">
                İptal ve İade Politikası
              </Link>
              .
            </>
          }
        />
        <FieldError name="consent" />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Ödeme sayfası hazırlanıyor…">
        {label}
      </SubmitButton>
      <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
        <Lock className="size-3.5" aria-hidden /> Kart bilgileriniz yalnızca bankanın 3D Secure sayfasında girilir. <CardLogos />
      </p>
    </ActionForm>
  );
}

export function CancelEnrollmentForm({ id, paid }: { id: string; paid: boolean }) {
  return (
    <ActionForm action={cancelEnrollmentAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" size="sm" pendingText="İptal ediliyor…" confirmMessage={paid ? "Kaydınız iptal edilip ücretin tamamı iade edilsin mi?" : "Davet/kayıt kapatılsın mı?"}>
        {paid ? "Kaydı iptal et (tam iade)" : "Kaydı kapat"}
      </SubmitButton>
    </ActionForm>
  );
}

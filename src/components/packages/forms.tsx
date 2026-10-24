"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  approvePackageBookingsAction,
  buyPackageAction,
  cancelRescheduleAction,
  refundPackageAction,
  requestRescheduleAction,
  respondRescheduleAction,
  savePackageDiscountsAction,
} from "@/actions/packages";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { CardLogos } from "@/components/site/card-logos";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

/** Veli: paket / tekrarlayan ders ödemesi. */
export function BuyPackageForm({ offeringId, duration, lessons, repeatAt, weeks, defaultName, label }: { offeringId: string; duration: number; lessons: number; repeatAt?: string; weeks?: number; defaultName: string; label: string }) {
  return (
    <ActionForm action={buyPackageAction} className="space-y-4">
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="lessons" value={lessons} />
      {repeatAt ? (
        <>
          <input type="hidden" name="tekrar" value={repeatAt} />
          <input type="hidden" name="hafta" value={weeks} />
          <Field label="Ders kimin için?">
            <Input name="learnerName" required maxLength={80} defaultValue={defaultName} />
            <FieldError name="learnerName" />
          </Field>
          <Field label="Öğretmene not (isteğe bağlı)">
            <Textarea name="note" rows={2} maxLength={1000} placeholder="Örn: 8. sınıf, LGS matematik; geometride zorlanıyor." />
          </Field>
        </>
      ) : null}
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

export function RefundPackageForm({ id, amountText }: { id: string; amountText: string }) {
  return (
    <ActionForm action={refundPackageAction}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="outline" size="sm" pendingText="İade ediliyor…" confirmMessage={`Kalan dersler iade edilip paket kapatılsın mı? (${amountText})`}>
        Kalan dersleri iade et ({amountText})
      </SubmitButton>
    </ActionForm>
  );
}

/** Öğretmen: paket indirimleri (en fazla 3 satır). */
export function PackageDiscountsForm({ rows, maxLessons, maxPercent }: { rows: { lessons: number; percent: number }[]; maxLessons: number; maxPercent: number }) {
  const filled = [...rows, { lessons: 0, percent: 0 }, { lessons: 0, percent: 0 }, { lessons: 0, percent: 0 }].slice(0, 3);
  return (
    <ActionForm action={savePackageDiscountsAction} className="space-y-3">
      {filled.map((row, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <Input name="lessons" type="number" min={0} max={maxLessons} defaultValue={row.lessons || ""} placeholder={i === 0 ? "5" : i === 1 ? "10" : ""} className="w-24" aria-label="Ders sayısı" />
          <span>ders alana</span>
          <Input name="percent" type="number" min={0} max={maxPercent} defaultValue={row.lessons ? row.percent : ""} placeholder={i === 0 ? "5" : i === 1 ? "10" : ""} className="w-20" aria-label="İndirim yüzdesi" />
          <span>% indirim</span>
        </div>
      ))}
      <p className="text-xs text-slate-500">Boş bırakılan satırlar kaydedilmez; hepsini boşaltırsanız paket satışı kapanır. Tekrarlayan derslerde de hafta sayısına uyan indirim uygulanır.</p>
      <SubmitButton size="sm" pendingText="Kaydediliyor…">
        Paketleri kaydet
      </SubmitButton>
    </ActionForm>
  );
}

export function ApprovePackageForm({ packageId, count }: { packageId: string; count: number }) {
  return (
    <ActionForm action={approvePackageBookingsAction}>
      <input type="hidden" name="packageId" value={packageId} />
      <SubmitButton size="sm" pendingText="Onaylanıyor…">
        Bu paketin {count} talebini birden onayla
      </SubmitButton>
    </ActionForm>
  );
}

type Day = { date: string; weekday: string; day: string; slots: { start: string; time: string; available: boolean }[] };

/** Erteleme önerisi: öğretmenin boş saatlerinden yeni saat seçilir. */
export function RescheduleForm({ bookingId, teacherId, duration, today }: { bookingId: string; teacherId: string; duration: number; today: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(today);
  const [days, setDays] = useState<Day[] | null>(null);
  const [picked, setPicked] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/saatler?ogretmen=${teacherId}&sure=${duration}&baslangic=${start}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setDays(data.days ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [open, start, teacherId, duration]);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand-700 hover:underline">
        Başka bir saat öner (ertele)
      </button>
    );
  }
  const slots = days?.flatMap((d) => d.slots.filter((s) => s.available).map((s) => ({ ...s, label: `${d.day} ${d.weekday} · ${s.time}` }))) ?? [];
  return (
    <ActionForm action={requestRescheduleAction} className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Hafta başlangıcı">
          <Input type="date" value={start} min={today} onChange={(e) => setStart(e.target.value || today)} />
        </Field>
        <Field label="Yeni saat" className="min-w-56 flex-1">
          <Select name="newStartAt" value={picked} onChange={(e) => setPicked(e.target.value)} required>
            <option value="">{days === null ? "Yükleniyor…" : slots.length ? "Seçin" : "Bu hafta boş saat yok"}</option>
            {slots.map((s) => (
              <option key={s.start} value={s.start}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Not (isteğe bağlı)">
        <Input name="note" maxLength={300} placeholder="Örn: O gün okulda sınavım var" />
      </Field>
      <SubmitButton size="sm" pendingText="Gönderiliyor…" disabled={!picked}>
        Öneriyi gönder
      </SubmitButton>
    </ActionForm>
  );
}

export function RescheduleResponse({ requestId, mine }: { requestId: string; mine: boolean }) {
  if (mine) {
    return (
      <ActionForm action={cancelRescheduleAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <SubmitButton size="sm" variant="outline" pendingText="…">
          Öneriyi geri çek
        </SubmitButton>
      </ActionForm>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <ActionForm action={respondRescheduleAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="decision" value="accept" />
        <SubmitButton size="sm" pendingText="…">
          Kabul et
        </SubmitButton>
      </ActionForm>
      <ActionForm action={respondRescheduleAction}>
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="decision" value="decline" />
        <SubmitButton size="sm" variant="outline" pendingText="…">
          Reddet
        </SubmitButton>
      </ActionForm>
    </div>
  );
}

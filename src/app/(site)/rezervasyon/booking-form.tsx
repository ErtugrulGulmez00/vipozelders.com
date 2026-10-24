"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createBookingAction } from "@/actions/student";
import { CardLogos } from "@/components/site/card-logos";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { CouponField } from "@/components/forms/coupon-field";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export function BookingForm({
  offeringId,
  startAt,
  duration,
  mode,
  learners,
  defaultName,
  grades,
  places,
  districts,
  notePlaceholder,
  packageId,
  intro = false,
}: {
  offeringId: string;
  startAt: string;
  duration: number;
  mode: "ONLINE" | "IN_PERSON";
  learners: { name: string; gradeName: string | null }[];
  defaultName: string;
  grades: string[];
  places: { home: boolean; teacher: boolean };
  districts: { id: number; name: string }[];
  notePlaceholder: string;
  /** Paketten kullanım: ödeme ve sözleşme adımı yok */
  packageId?: string;
  intro?: boolean;
}) {
  const [learnerName, setLearnerName] = useState(learners[0]?.name ?? "");
  const [grade, setGrade] = useState(learners[0]?.gradeName ?? "");
  const [place, setPlace] = useState(places.home ? "STUDENT_HOME" : "TEACHER_PLACE");

  return (
    <ActionForm action={createBookingAction} className="space-y-5">
      <input type="hidden" name="offeringId" value={offeringId} />
      {packageId ? <input type="hidden" name="packageId" value={packageId} /> : null}
      <input type="hidden" name="startAt" value={startAt} />
      <input type="hidden" name="duration" value={duration} />
      <input type="hidden" name="mode" value={mode} />
      {intro ? <input type="hidden" name="intro" value="1" /> : null}

      {learners.length ? (
        <div>
          <Label>Ders kimin için?</Label>
          <div className="flex flex-wrap gap-2">
            {learners.map((learner) => (
              <button
                key={learner.name}
                type="button"
                onClick={() => {
                  setLearnerName(learner.name);
                  setGrade(learner.gradeName ?? "");
                }}
                className={cn("rounded-full px-3 py-1.5 text-sm font-medium ring-1", learnerName === learner.name ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-700 ring-slate-300")}
              >
                {learner.name}
                {learner.gradeName ? ` · ${learner.gradeName}` : ""}
              </button>
            ))}
            <button type="button" onClick={() => { setLearnerName(""); setGrade(""); }} className="rounded-full px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200">
              + Başka biri
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Öğrencinin adı" htmlFor="learnerName" hint={learners.length ? undefined : `Kendiniz için alıyorsanız “${defaultName}” yazabilirsiniz.`}>
          <Input id="learnerName" name="learnerName" value={learnerName} onChange={(e) => setLearnerName(e.target.value)} required />
        </Field>
        <Field label="Sınıfı" htmlFor="learnerGrade">
          <Select id="learnerGrade" name="learnerGrade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Seçiniz</option>
            {[...new Set([...grades, ...(grade && !grades.includes(grade) ? [grade] : [])])].filter((g) => g !== "Diğer").map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value="Diğer">Diğer</option>
          </Select>
        </Field>
      </div>
      <FieldError name="learnerName" />

      {mode === "IN_PERSON" ? (
        <div className="space-y-4 rounded-xl bg-slate-50 p-4">
          {places.home && places.teacher ? (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-slate-700">Ders nerede yapılsın?</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "STUDENT_HOME", label: "Bizim adresimizde" },
                  { value: "TEACHER_PLACE", label: "Öğretmenin yerinde" },
                ].map((o) => (
                  <label key={o.value} className="cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-300 has-checked:ring-2 has-checked:ring-brand-500">
                    <input type="radio" name="place" value={o.value} checked={place === o.value} onChange={() => setPlace(o.value)} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <input type="hidden" name="place" value={place} />
          )}
          {place === "STUDENT_HOME" ? (
            <>
              <Field label="İlçe" htmlFor="districtId" hint="Öğretmenin hizmet verdiği ilçeler listelenir.">
                <Select id="districtId" name="districtId" required defaultValue="">
                  <option value="" disabled>
                    Seçiniz
                  </option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Açık adres" htmlFor="address" hint="Adres yalnızca öğretmen dersi onaylarsa paylaşılır.">
                <Textarea id="address" name="address" rows={2} required maxLength={500} />
              </Field>
            </>
          ) : (
            <p className="text-sm text-slate-600">Ders, öğretmenin belirlediği yerde yapılacak; adres onaydan sonra ders sayfanızda görünecek.</p>
          )}
        </div>
      ) : null}

      <Field label="Öğretmene not (isteğe bağlı)" htmlFor="note" hint="Hangi konularda destek istediğinizi, hedeflerinizi yazın.">
        <Textarea id="note" name="note" rows={3} maxLength={1000} placeholder={notePlaceholder} />
      </Field>

      {intro || packageId ? null : <CouponField target="booking" refId={offeringId} duration={duration} />}

      {intro || packageId ? null : (
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
      )}

      <SubmitButton size="lg" className="w-full" pendingText={intro || packageId ? "Gönderiliyor…" : "Ödeme sayfası hazırlanıyor…"}>
        {intro ? "Tanışma talebini gönder" : packageId ? "Paketimden ders talebi gönder" : "Ödemeye geç"}
      </SubmitButton>
      {intro || packageId ? null : (
        <p className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <Lock className="size-3.5" aria-hidden /> Kart bilgileriniz yalnızca bankanın 3D Secure sayfasında girilir. <CardLogos />
        </p>
      )}
    </ActionForm>
  );
}

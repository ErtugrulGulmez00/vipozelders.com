"use client";

import Link from "next/link";
import { useState } from "react";
import { submitLessonRequestAction } from "@/actions/lesson-requests";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

type Option = { id: number; name: string };

/** "Aradığınız öğretmeni bulamadınız mı?" talep formu (öğretmen listesinde). */
export function LessonRequestForm({
  levels,
  subjects,
  defaults,
}: {
  levels: (Option & { subjectIds: number[] })[];
  subjects: Option[];
  defaults: { levelId?: number; subjectId?: number; name?: string; email?: string; phone?: string };
}) {
  const [levelId, setLevelId] = useState(defaults.levelId ? String(defaults.levelId) : "");
  const level = levels.find((l) => String(l.id) === levelId);
  const options = level ? subjects.filter((s) => level.subjectIds.includes(s.id)) : [];
  return (
    <ActionForm action={submitLessonRequestAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Kademe">
        <Select name="levelId" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Seçin</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ders">
        <Select name="subjectId" defaultValue={defaults.subjectId ? String(defaults.subjectId) : ""} key={levelId} disabled={!level}>
          <option value="">{level ? "Seçin" : "Önce kademe seçin"}</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ders şekli">
        <Select name="mode" defaultValue="farketmez">
          <option value="farketmez">Fark etmez</option>
          <option value="online">Online</option>
          <option value="yuz-yuze">Yüz yüze</option>
        </Select>
      </Field>
      <Field label="Şehir (yüz yüze için)">
        <Input name="cityName" maxLength={60} placeholder="Örn: Tekirdağ" />
      </Field>
      <Field label="Uygun gün ve saatler" className="sm:col-span-2">
        <Input name="preferredTimes" maxLength={200} placeholder="Örn: Hafta içi 19.00 sonrası, cumartesi öğleden sonra" />
      </Field>
      <Field label="Adınız">
        <Input name="name" required maxLength={80} defaultValue={defaults.name} />
        <FieldError name="name" />
      </Field>
      <Field label="Telefon">
        <Input name="phone" type="tel" required placeholder="05XX XXX XX XX" defaultValue={defaults.phone} />
        <FieldError name="phone" />
      </Field>
      <Field label="E-posta (isteğe bağlı)" className="sm:col-span-2">
        <Input name="email" type="email" maxLength={120} defaultValue={defaults.email} />
        <FieldError name="email" />
      </Field>
      <Field label="Not (isteğe bağlı)" className="sm:col-span-2">
        <Textarea name="note" rows={2} maxLength={1000} placeholder="Örn: 8. sınıf, LGS'ye hazırlanıyor; geometride zorlanıyor." />
      </Field>
      <div className="sm:col-span-2">
        <Checkbox
          name="kvkk"
          required
          label={
            <>
              Bu bilgilerle benimle iletişime geçilmesini kabul ediyorum (
              <Link href="/sayfa/kvkk-aydinlatma-metni" target="_blank" className="font-medium text-brand-700 underline">
                KVKK Aydınlatma Metni
              </Link>
              ). Telefon numaram öğretmenlerle paylaşılmaz.
            </>
          }
        />
        <FieldError name="kvkk" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Gönderiliyor…">Talebimi gönder</SubmitButton>
      </div>
    </ActionForm>
  );
}

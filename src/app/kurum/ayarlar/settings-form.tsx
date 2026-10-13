"use client";

import { useEffect, useState } from "react";
import { updateCenterSettingsAction } from "@/actions/center/organization";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { CopyButton } from "@/components/ui/copy-button";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { CENTER_KIND_LABEL } from "@/lib/center/labels";

export type CenterSettingsValues = {
  name: string;
  kind: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cityId: number | null;
  districtId: number | null;
  taxOffice: string | null;
  taxNumber: string | null;
  description: string | null;
  isPublic: boolean;
  academicYear: string;
  notifyAbsence: boolean;
  remindPayments: boolean;
  reminderDaysBefore: number;
  showTeacherSuggestions: boolean;
  loginUrl: string;
  logoUrl: string | null;
  slug: string;
};

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function CenterSettingsForm({ values, cities, initialDistricts }: { values: CenterSettingsValues; cities: { id: number; name: string }[]; initialDistricts: { id: number; name: string }[] }) {
  const [cityId, setCityId] = useState(values.cityId ? String(values.cityId) : "");
  const [districts, setDistricts] = useState(initialDistricts);
  useEffect(() => {
    if (!cityId || cityId === String(values.cityId ?? "")) return;
    let cancelled = false;
    fetch(`/api/ilceler?il=${cityId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { id: number; name: string }[]) => {
        if (!cancelled) setDistricts(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [cityId, values.cityId]);
  return (
    <ActionForm action={updateCenterSettingsAction} className="space-y-6">
      <Section title="Kurum bilgileri" description="Makbuzlarda, velilere giden mesajlarda ve vitrin sayfasında kullanılır.">
        <Field label="Kurum adı">
          <Input name="name" defaultValue={values.name} required />
          <FieldError name="name" />
        </Field>
        <Field label="Kurum türü">
          <Select name="kind" defaultValue={values.kind}>
            {Object.entries(CENTER_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Telefon">
          <Input name="phone" defaultValue={values.phone ?? ""} placeholder="0212 000 00 00" />
        </Field>
        <Field label="E-posta">
          <Input name="email" type="email" defaultValue={values.email ?? ""} />
          <FieldError name="email" />
        </Field>
        <Field label="İl">
          <Select name="cityId" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">Seçin</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="İlçe">
          <Select name="districtId" defaultValue={values.districtId ? String(values.districtId) : ""} key={cityId}>
            <option value="">Seçin</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Adres" className="sm:col-span-2">
          <Input name="address" defaultValue={values.address ?? ""} />
        </Field>
        <Field label="Vergi dairesi">
          <Input name="taxOffice" defaultValue={values.taxOffice ?? ""} />
        </Field>
        <Field label="Vergi / T.C. no">
          <Input name="taxNumber" defaultValue={values.taxNumber ?? ""} />
        </Field>
        <Field label="Eğitim yılı" hint="Ödeme planı adlarında kullanılır.">
          <Input name="academicYear" defaultValue={values.academicYear} placeholder="2026-2027" />
          <FieldError name="academicYear" />
        </Field>
        <Field label="Logo" htmlFor="center-logo" hint="JPG, PNG ya da WEBP; en fazla 2 MB">
          {values.logoUrl ? (
            <div className="mb-2 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={values.logoUrl} alt="Kurum logosu" className="size-12 rounded-lg border border-slate-200 object-contain" />
              <Checkbox name="removeLogo" label="Logoyu kaldır" />
            </div>
          ) : null}
          <FileInput id="center-logo" name="logo" accept="image/png,image/jpeg,image/webp" />
          <FieldError name="logo" />
        </Field>
      </Section>
      <Section title="Vitrin sayfası" description={`Herkese açık tanıtım sayfası ve ön kayıt formu: /kurumlar/${values.slug}`}>
        <div className="sm:col-span-2">
          <Checkbox name="isPublic" defaultChecked={values.isPublic} label="Kurumum Pi Kampüs kurum rehberinde görünsün ve veliler ön kayıt bırakabilsin" />
        </div>
        <Field label="Tanıtım yazısı" className="sm:col-span-2">
          <Textarea name="description" rows={5} defaultValue={values.description ?? ""} placeholder="Kurumunuzu, programlarınızı, başarılarınızı anlatın." />
        </Field>
      </Section>
      <Section title="Veli portalı" description="Veliler devamsızlık, deneme sonucu, eksik konu, ödeme ve duyuruları sitedeki hesaplarından görür.">
        <div className="sm:col-span-2">
          <Checkbox
            name="showTeacherSuggestions"
            defaultChecked={values.showTeacherSuggestions}
            label="Eksik konularda velilere Pi Kampüs’ün onaylı özel ders öğretmenlerini öner"
          />
          <p className="mt-1 pl-6.5 text-xs text-slate-500">Kapatırsanız veli portalında, karnede ve mobil uygulamada öğretmen önerisi görünmez; eksik konular yine listelenir.</p>
        </div>
      </Section>
      <Section title="Personel girişi" description="Personelinize bu adresi verin; giriş sayfasında kurumunuzun adı ve logosu görünür.">
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <code className="rounded-lg bg-slate-100 px-3 py-2 text-sm">{values.loginUrl}</code>
          <CopyButton value={values.loginUrl} label="Adresi kopyala" />
        </div>
      </Section>
      <Section title="Verileriniz" description="Kayıtlarınız size aittir. Öğrenci, veli, yoklama, deneme, ödev, muhasebe ve not kayıtlarının tamamını tek Excel dosyası olarak indirebilirsiniz (T.C. kimlik numaraları dahil edilmez).">
        <div className="sm:col-span-2">
          <a href="/api/kurum/disa-aktar/tum-veriler" download className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            Tüm verileri indir (.xlsx)
          </a>
        </div>
      </Section>
      <Section title="Otomatik bildirimler">
        <div className="space-y-3 sm:col-span-2">
          <Checkbox name="notifyAbsence" defaultChecked={values.notifyAbsence} label="Yoklamada “gelmedi” işaretlenen öğrencinin velisine bildirim gönder" />
          <Checkbox name="remindPayments" defaultChecked={values.remindPayments} label="Taksit vadesinden önce ve vade geçince veliye otomatik hatırlatma gönder" />
        </div>
        <Field label="Vadeden kaç gün önce hatırlatılsın">
          <Input name="reminderDaysBefore" type="number" min={0} max={14} defaultValue={values.reminderDaysBefore} />
        </Field>
      </Section>
      <SubmitButton size="lg">Ayarları kaydet</SubmitButton>
    </ActionForm>
  );
}

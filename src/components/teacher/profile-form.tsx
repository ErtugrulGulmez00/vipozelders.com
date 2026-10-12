"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { removePhotoAction, saveProfileAction } from "@/actions/teacher";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Avatar } from "@/components/ui/primitives";

export type ProfileFormValues = {
  teacherId: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  headline: string;
  bio: string;
  education: string;
  experienceYears: number;
  gender: string;
  videoUrl: string;
  cityId: number | null;
  districtId: number | null;
  offersOnline: boolean;
  offersInPerson: boolean;
  inPersonAtStudentHome: boolean;
  inPersonAtTeacherPlace: boolean;
  serviceDistrictIds: number[];
  declared: boolean;
};

type District = { id: number; name: string };

export function ProfileForm({
  values,
  cities,
  initialDistricts,
  isAdmin = false,
}: {
  values: ProfileFormValues;
  cities: { id: number; name: string }[];
  initialDistricts: District[];
  isAdmin?: boolean;
}) {
  const [cityId, setCityId] = useState<number | null>(values.cityId);
  const [districts, setDistricts] = useState<District[]>(initialDistricts);
  const [inPerson, setInPerson] = useState(values.offersInPerson);
  const [bioLength, setBioLength] = useState(values.bio.length);

  useEffect(() => {
    if (!cityId || cityId === values.cityId) return;
    let cancelled = false;
    fetch(`/api/ilceler?il=${cityId}`)
      .then((r) => r.json())
      .then((data: District[]) => {
        if (!cancelled) setDistricts(data);
      });
    return () => {
      cancelled = true;
    };
  }, [cityId, values.cityId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={values.photoUrl} name={values.name} initials={values.initials} size={88} />
        <div className="text-sm text-slate-600">
          <p className="font-medium text-slate-800">Profil fotoğrafı</p>
          <p>Yüzünüzün net göründüğü, güler yüzlü bir fotoğraf velilerin güvenini artırır. JPG/PNG/WEBP, en fazla 5 MB.</p>
          {values.photoUrl ? (
            <form action={removePhotoAction} className="mt-2">
              <input type="hidden" name="teacherId" value={values.teacherId} />
              <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline">
                <Trash2 className="size-3.5" aria-hidden /> Fotoğrafı kaldır
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <ActionForm action={saveProfileAction} className="space-y-5" encType="multipart/form-data">
        <input type="hidden" name="teacherId" value={values.teacherId} />
        <Field label="Yeni fotoğraf yükle" htmlFor="photo">
          <FileInput id="photo" name="photo" accept="image/jpeg,image/png,image/webp" placeholder="Fotoğraf seçin (JPG, PNG veya WEBP)" />
        </Field>

        <Field label="Kısa başlık" htmlFor="headline" hint="Örn: 12 yıllık deneyimli matematik öğretmeni · LGS ve YKS uzmanı">
          <Input id="headline" name="headline" defaultValue={values.headline} maxLength={120} />
        </Field>
        <Field label="Hakkımda" htmlFor="bio" hint={`${bioLength} / 3000 karakter · en az 100 karakter önerilir. Telefon, e-posta veya sosyal medya adresi yazmayın.`}>
          <Textarea id="bio" name="bio" rows={7} defaultValue={values.bio} maxLength={3000} onChange={(e) => setBioLength(e.target.value.length)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Eğitim" htmlFor="education" className="sm:col-span-2">
            <Input id="education" name="education" defaultValue={values.education} placeholder="Üniversite · Bölüm" />
          </Field>
          <Field label="Deneyim (yıl)" htmlFor="experienceYears">
            <Input id="experienceYears" name="experienceYears" type="number" min={0} max={60} defaultValue={values.experienceYears} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cinsiyet" htmlFor="gender" hint="Veliler öğretmen cinsiyetine göre filtreleyebilir.">
            <Select id="gender" name="gender" defaultValue={values.gender}>
              <option value="UNSPECIFIED">Belirtmek istemiyorum</option>
              <option value="FEMALE">Kadın</option>
              <option value="MALE">Erkek</option>
            </Select>
          </Field>
          <Field label="Tanıtım videosu (YouTube)" htmlFor="videoUrl">
            <Input id="videoUrl" name="videoUrl" type="url" defaultValue={values.videoUrl} placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
        </div>
        <FieldError name="videoUrl" />

        <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">Ders şekli ve konum</legend>
          <Checkbox name="offersOnline" defaultChecked={values.offersOnline} label="Online ders veriyorum (sitedeki sanal sınıf)" />
          <Checkbox name="offersInPerson" defaultChecked={values.offersInPerson} onChange={(e) => setInPerson(e.target.checked)} label="Yüz yüze ders veriyorum" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="İl" htmlFor="cityId">
              <Select id="cityId" name="cityId" value={cityId ?? ""} onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Seçiniz</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="İlçe" htmlFor="districtId">
              <Select id="districtId" name="districtId" defaultValue={values.districtId ?? ""} key={cityId ?? "none"}>
                <option value="">Seçiniz</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <FieldError name="cityId" />
          {inPerson ? (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <Checkbox name="inPersonAtStudentHome" defaultChecked={values.inPersonAtStudentHome} label="Öğrencinin adresine gidiyorum" />
              <Checkbox name="inPersonAtTeacherPlace" defaultChecked={values.inPersonAtTeacherPlace} label="Kendi yerimde (ev/ofis/etüt merkezi) ders veriyorum" />
              <div>
                <Label>Hizmet verdiğim ilçeler</Label>
                <p className="mb-2 text-xs text-slate-500">Seçmezseniz seçtiğiniz il genelinde görünürsünüz.</p>
                <div className="grid max-h-52 grid-cols-2 gap-x-3 gap-y-1.5 overflow-y-auto rounded-lg bg-white p-2 sm:grid-cols-3" key={cityId ?? "none"}>
                  {districts.map((d) => (
                    <label key={d.id} className="flex items-center gap-1.5 text-xs text-slate-700">
                      <input type="checkbox" name="serviceDistricts" value={d.id} defaultChecked={values.serviceDistrictIds.includes(d.id)} className="accent-brand-600" />
                      {d.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </fieldset>

        <div className="rounded-xl bg-amber-50 p-4">
          <Checkbox
            name="declaration"
            defaultChecked={values.declared}
            label={
              <>
                Devlet okulunda kadrolu öğretmen olmadığımı veya ücretli özel ders vermeme mevzuatın izin verdiğini beyan ederim;{" "}
                <Link href="/sayfa/ogretmen-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
                  Öğretmen Hizmet Sözleşmesi
                </Link>
                ’ni okudum ve kabul ediyorum.
              </>
            }
          />
          {isAdmin ? <p className="mt-2 text-xs text-amber-800">Yönetici olarak düzenliyorsunuz: beyanı öğretmenin kendisinin vermesi önerilir.</p> : null}
        </div>

        <SubmitButton size="lg">Profili kaydet</SubmitButton>
      </ActionForm>
    </div>
  );
}

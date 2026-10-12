"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Checkbox, Input, Label, Select } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { Catalog } from "@/server/catalog";

type Option = { value: string; label: string };

export type FilterValues = Record<string, string | undefined>;

/** Öğretmen listesi filtreleri: her değişiklikte form kendiliğinden gönderilir (adres çubuğu güncellenir). */
export function FilterPanel({
  catalog,
  cities,
  districts,
  values,
  timeOptions,
}: {
  catalog: Catalog;
  cities: { slug: string; name: string }[];
  districts: { slug: string; name: string }[];
  values: FilterValues;
  timeOptions: readonly Option[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const submit = () => formRef.current?.requestSubmit();
  const level = catalog.levels.find((l) => l.slug === values.level);
  const subjects = level ? catalog.subjects.filter((s) => level.subjectIds.includes(s.id)) : catalog.subjects;
  const activeCount = ["level", "subject", "service", "mode", "city", "district", "minPrice", "maxPrice", "rating", "gender", "time", "verified", "q"].filter((k) => values[k]).length;

  return (
    // Telefonda filtreler bir düğmenin arkasında kapalı gelir (sonuçlar hemen görünsün); geniş ekranda hep açık.
    <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="filter-form"
          className="inline-flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-900 lg:pointer-events-none"
        >
          <SlidersHorizontal className="size-4" aria-hidden /> Filtreler {activeCount ? <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{activeCount}</span> : null}
          <ChevronDown className={cn("ml-auto size-4 text-slate-400 transition lg:hidden", open && "rotate-180")} aria-hidden />
        </button>
        {activeCount ? (
          <Link href="/ogretmenler" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600">
            <X className="size-3.5" aria-hidden /> Temizle
          </Link>
        ) : null}
      </div>
      <Form
        ref={formRef}
        id="filter-form"
        action="/ogretmenler"
        className={cn("mt-4 space-y-4 lg:block", open ? "block" : "hidden")}
        onChange={(e) => {
          // Metin ve sayı alanları odaktan çıkınca gönderilir; seçimler anında.
          const target = e.target;
          if (target instanceof HTMLInputElement && ["text", "number", "search"].includes(target.type)) return;
          submit();
        }}
      >
        {values.sort ? <input type="hidden" name="sort" value={values.sort} /> : null}
        <div>
          <Label htmlFor="f-q">Öğretmen ara</Label>
          <Input id="f-q" name="q" type="search" defaultValue={values.q} placeholder="Ad, ders veya üniversite" onBlur={submit} />
        </div>
        <div>
          <Label htmlFor="f-level">Kademe</Label>
          <Select id="f-level" name="level" defaultValue={values.level ?? ""}>
            <option value="">Tümü</option>
            {catalog.levels.map((l) => (
              <option key={l.id} value={l.slug}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-subject">Ders</Label>
          <Select id="f-subject" name="subject" defaultValue={values.subject ?? ""} key={values.level ?? "all"}>
            <option value="">Tümü</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-service">Hizmet</Label>
          <Select id="f-service" name="service" defaultValue={values.service ?? ""}>
            <option value="">Tümü</option>
            {catalog.services.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Ders şekli</legend>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
            {[
              { value: "", label: "Hepsi" },
              { value: "online", label: "Online" },
              { value: "yuz-yuze", label: "Yüz yüze" },
            ].map((o) => (
              <label key={o.value} className="cursor-pointer rounded-md py-1.5 text-center text-slate-600 has-checked:bg-white has-checked:text-brand-700 has-checked:shadow-xs">
                <input type="radio" name="mode" value={o.value} defaultChecked={(values.mode ?? "") === o.value} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        {values.mode !== "online" ? (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Yüz yüze ders için konum</p>
            <Select name="city" aria-label="İl" defaultValue={values.city ?? ""}>
              <option value="">Tüm iller</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
            {values.city ? (
              <Select name="district" aria-label="İlçe" defaultValue={values.district ?? ""} key={values.city}>
                <option value="">Tüm ilçeler</option>
                {districts.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </Select>
            ) : null}
          </div>
        ) : null}
        <div>
          <Label>Saatlik ücret (₺)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input name="minPrice" type="number" min={0} step={50} placeholder="En az" defaultValue={values.minPrice} onBlur={submit} aria-label="En az ücret" />
            <Input name="maxPrice" type="number" min={0} step={50} placeholder="En çok" defaultValue={values.maxPrice} onBlur={submit} aria-label="En çok ücret" />
          </div>
        </div>
        <div>
          <Label htmlFor="f-rating">Puan</Label>
          <Select id="f-rating" name="rating" defaultValue={values.rating ?? ""}>
            <option value="">Fark etmez</option>
            <option value="4">4 ve üzeri</option>
            <option value="3">3 ve üzeri</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="f-time">Müsaitlik</Label>
          <Select id="f-time" name="time" defaultValue={values.time ?? ""}>
            <option value="">Fark etmez</option>
            {timeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="f-gender">Öğretmen</Label>
          <Select id="f-gender" name="gender" defaultValue={values.gender ?? ""}>
            <option value="">Fark etmez</option>
            <option value="kadin">Kadın öğretmen</option>
            <option value="erkek">Erkek öğretmen</option>
          </Select>
        </div>
        <Checkbox name="verified" value="1" defaultChecked={values.verified === "1"} label="Yalnızca onaylı öğretmenler" />
        <noscript>
          <button type="submit" className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white">
            Filtrele
          </button>
        </noscript>
      </Form>
    </div>
  );
}

export function SortSelect({ value, options }: { value: string; options: readonly Option[] }) {
  const router = useRouter();
  return (
    <label className="flex w-full items-center gap-2 text-sm text-slate-500 sm:w-auto">
      <span className="shrink-0">Sırala:</span>
      <Select
        aria-label="Sıralama"
        defaultValue={value}
        className="h-9 sm:w-52"
        onChange={(e) => {
          const url = new URL(window.location.href);
          url.searchParams.set("sort", e.target.value);
          url.searchParams.delete("page");
          router.push(`${url.pathname}${url.search}`);
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

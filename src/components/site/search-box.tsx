"use client";

import { Search } from "lucide-react";
import Form from "next/form";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import type { Catalog } from "@/server/catalog";

/** Ana sayfadaki hızlı arama: kademe seçilince ders listesi daralır. */
export function SearchBox({ catalog }: { catalog: Catalog }) {
  const [levelSlug, setLevelSlug] = useState("");
  const level = catalog.levels.find((l) => l.slug === levelSlug);
  const subjects = level ? catalog.subjects.filter((s) => level.subjectIds.includes(s.id)) : catalog.subjects;

  return (
    <Form action="/ogretmenler" className="grid gap-2 rounded-[1.75rem] bg-ink-900 p-2.5 shadow-xl sm:grid-cols-[1fr_1fr_0.8fr_auto]">
      <label className="sr-only" htmlFor="search-level">Kademe</label>
      <Select id="search-level" name="level" value={levelSlug} onChange={(e) => setLevelSlug(e.target.value)} className="h-14 rounded-2xl border-0 bg-white font-semibold text-ink-900">
        <option value="">Tüm kademeler</option>
        {catalog.levels.map((l) => (
          <option key={l.id} value={l.slug}>
            {l.name}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="search-subject">Ders</label>
      <Select id="search-subject" name="subject" defaultValue="" key={levelSlug} className="h-14 rounded-2xl border-0 bg-white font-semibold text-ink-900">
        <option value="">Tüm dersler</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.slug}>
            {s.name}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="search-mode">Ders şekli</label>
      <Select id="search-mode" name="mode" defaultValue="" className="h-14 rounded-2xl border-0 bg-white font-semibold text-ink-900">
        <option value="">Online veya yüz yüze</option>
        <option value="online">Online</option>
        <option value="yuz-yuze">Yüz yüze</option>
      </Select>
      <button type="submit" className={buttonClasses("primary", "lg", "h-14 rounded-2xl text-base")}>
        <Search className="size-4" aria-hidden /> Öğretmen bul
      </button>
    </Form>
  );
}

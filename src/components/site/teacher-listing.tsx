import { SearchX } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState, Pagination, Skeleton } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { loadDistricts } from "@/server/catalog";
import { getCatalog, getCities } from "@/server/site";
import { searchTeachers, SORT_OPTIONS, TIME_OPTIONS, type TeacherSearchParams } from "@/server/teachers";
import { FilterPanel, SortSelect } from "./filter-panel";
import { TeacherCard } from "./teacher-card";

const KEYS: (keyof TeacherSearchParams)[] = ["level", "subject", "service", "mode", "city", "district", "minPrice", "maxPrice", "rating", "gender", "time", "verified", "q", "sort", "page"];

function pick(raw: Record<string, string | string[] | undefined>): TeacherSearchParams {
  const params: TeacherSearchParams = {};
  for (const key of KEYS) {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) params[key] = first.slice(0, 80);
  }
  return params;
}

/** Öğretmen listesi: /ogretmenler ve /ozel-ders/... sayfaları ortak kullanır. */
export async function TeacherListing({
  searchParams,
  preset,
  basePath,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  preset?: { level?: string; subject?: string };
  basePath: string;
}) {
  const params = { ...pick(await searchParams), ...preset };
  const [catalog, cities, result] = await Promise.all([getCatalog(), getCities(), searchTeachers(params)]);

  if (preset?.level && !result.resolved.level) notFound();
  if (preset?.subject && !result.resolved.subject) notFound();

  const districts = result.resolved.city ? await loadDistricts(result.resolved.city.id) : [];
  const { level, subject, service, city, district } = result.resolved;
  const title = [
    district ? `${district.name}` : city ? city.name : null,
    level?.name,
    subject?.name,
    service ? service.name.toLocaleLowerCase("tr-TR") : "özel ders",
    "öğretmenleri",
  ]
    .filter(Boolean)
    .join(" ");

  const hrefFor = (page: number) => {
    const entries = Object.entries(params).filter(([key, value]) => value && key !== "page" && !(preset && key in preset));
    const query = new URLSearchParams(entries as [string, string][]);
    if (page > 1) query.set("page", String(page));
    const qs = query.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <FilterPanel catalog={catalog} cities={cities} districts={districts} values={params} timeOptions={TIME_OPTIONS} />
      </aside>
      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 first-letter:uppercase">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{result.total} öğretmen bulundu</p>
          </div>
          <SortSelect value={params.sort ?? "onerilen"} options={SORT_OPTIONS} />
        </div>
        {result.items.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {result.items.map((teacher) => (
              <TeacherCard key={teacher.userId} teacher={teacher} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<SearchX className="size-8" />}
            title="Bu filtrelere uygun öğretmen bulamadık"
            description="Filtrelerden birkaçını kaldırmayı ya da online dersleri de dahil etmeyi deneyin."
            action={<LinkButton href="/ogretmenler" variant="outline">Filtreleri temizle</LinkButton>}
          />
        )}
        <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
      </section>
    </div>
  );
}

export function TeacherListingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Skeleton className="h-[560px] rounded-2xl" />
      <div>
        <Skeleton className="mb-5 h-10 w-80" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

import { SearchX } from "lucide-react";
import { notFound } from "next/navigation";
import { EmptyState, Pagination, Skeleton } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { loadDistricts } from "@/server/catalog";
import { getCatalog, getCities } from "@/server/site";
import { searchTeachers, SORT_OPTIONS, TIME_OPTIONS, type TeacherSearchParams } from "@/server/teachers";
import { getCurrentUser } from "@/server/auth/current-user";
import { FilterPanel, SortSelect } from "./filter-panel";
import { LessonRequestForm } from "./lesson-request-form";
import { TeacherCard } from "./teacher-card";

const KEYS: (keyof TeacherSearchParams)[] = ["level", "subject", "service", "mode", "city", "district", "minPrice", "maxPrice", "rating", "gender", "time", "verified", "intro", "abonelik", "q", "sort", "page"];

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
  // Sonuç yoksa veli boş sayfayla kalmasın: önce aynı dersin, yoksa tüm öğretmenler önerilir.
  const fallback = result.items.length ? null : await similarTeachers(params);
  const user = await getCurrentUser();
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
          <>
            <EmptyState
              icon={<SearchX className="size-8" />}
              title="Bu filtrelere uygun öğretmen henüz yok"
              description="Yeni öğretmenlerimiz her hafta katılıyor. Filtrelerden birkaçını kaldırabilir ya da takıldığınız soruyu hemen branş öğretmenlerimize sorabilirsiniz."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <LinkButton href="/ogretmenler" variant="outline">Filtreleri temizle</LinkButton>
                  <LinkButton href="/soru-sor" variant="ghost">Soru sor</LinkButton>
                </div>
              }
            />
            {fallback?.items.length ? (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-slate-900">{fallback.title}</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {fallback.items.map((teacher) => (
                    <TeacherCard key={teacher.userId} teacher={teacher} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
        <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
        <details open={!result.items.length} className="group mt-8 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
          <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="block text-lg font-bold text-slate-900">Aradığınız öğretmeni bulamadınız mı?</span>
            <span className="block text-sm text-slate-600">Ders ve uygun saatlerinizi bırakın; size uygun öğretmeni bulup dönelim. Ücretsizdir.</span>
          </summary>
          <div className="mt-5">
            <LessonRequestForm
              levels={catalog.levels.map((l) => ({ id: l.id, name: l.name, subjectIds: l.subjectIds }))}
              subjects={catalog.subjects.map((s) => ({ id: s.id, name: s.name }))}
              defaults={{ levelId: level?.id, subjectId: subject?.id, name: user?.role === "STUDENT" ? `${user.firstName} ${user.lastName}` : undefined, email: user?.role === "STUDENT" ? user.email ?? undefined : undefined }}
            />
          </div>
        </details>
      </section>
    </div>
  );
}

async function similarTeachers(params: TeacherSearchParams) {
  if (params.subject) {
    const sameSubject = await searchTeachers({ subject: params.subject });
    if (sameSubject.items.length) return { title: `${sameSubject.resolved.subject?.name ?? "Bu ders"} dersi veren öğretmenlerimiz`, items: sameSubject.items.slice(0, 4) };
  }
  const all = await searchTeachers({});
  return { title: "Öğretmenlerimize göz atın", items: all.items.slice(0, 4) };
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

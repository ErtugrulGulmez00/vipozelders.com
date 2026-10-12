import { Building2, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { CENTER_KIND_LABEL } from "@/lib/center/labels";
import { listPublicCenters, publicCenterCities } from "@/server/center/public";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Etüt merkezleri ve dershaneler",
  description: "Pi Kampüs kurum rehberi: bölgenizdeki etüt merkezleri, dershaneler ve kurslar. Programları inceleyin, ön kayıt bırakın.",
};

export default function CentersDirectoryPage({ searchParams }: PageProps<"/kurumlar">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Etüt merkezleri ve dershaneler</h1>
          <p className="mt-1 text-slate-600">Pi Kampüs kurum panelini kullanan kurumlar. Veliler devamsızlık, deneme ve ödemeleri telefondan takip eder.</p>
        </div>
        <Link href="/kurumlar-icin" className={buttonClasses("outline", "sm")}>
          Kurumunuzu ekleyin
        </Link>
      </div>
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}

async function Directory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const cityId = Number(sp.il) || null;
  const [centers, cities] = await Promise.all([listPublicCenters(cityId), publicCenterCities()]);
  return (
    <>
      {cities.length > 1 ? (
        <Form action="/kurumlar" className="mb-6 flex gap-2">
          <Select name="il" defaultValue={cityId ? String(cityId) : ""} className="w-56" aria-label="İl">
            <option value="">Tüm iller</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClasses("secondary")}>
            Göster
          </button>
        </Form>
      ) : null}
      {centers.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-8" />}
          title="Bu bölgede henüz kurum yok"
          description="Kurumunuzu Pi Kampüs'e ekleyin; vitrin sayfanızdan gelen ön kayıtlar doğrudan panelinize düşsün."
          action={
            <Link href="/kurumlar-icin" className={buttonClasses("primary")}>
              Kurumlar için
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {centers.map((c) => {
            const logo = uploadUrl(c.logoKey);
            return (
              <Link key={c.slug} href={`/kurumlar/${c.slug}`} className="group">
                <Card className="h-full p-5 transition group-hover:border-brand-300 group-hover:shadow-md">
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <Image src={logo} alt="" width={48} height={48} unoptimized className="size-12 rounded-xl border border-slate-100 object-contain" />
                    ) : (
                      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-700">{c.name.charAt(0)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900 group-hover:text-brand-700">{c.name}</p>
                      <p className="text-xs text-slate-500">{CENTER_KIND_LABEL[c.kind]}</p>
                    </div>
                  </div>
                  {c.city ? (
                    <p className="mt-3 inline-flex items-center gap-1 text-sm text-slate-600">
                      <MapPin className="size-4 text-slate-400" aria-hidden /> {[c.district, c.city].filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                  {c.description ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.description}</p> : null}
                  {c.programs.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.programs.slice(0, 4).map((p) => (
                        <span key={p} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

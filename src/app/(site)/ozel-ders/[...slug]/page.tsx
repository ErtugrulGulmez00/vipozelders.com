import type { Metadata } from "next";
import { Suspense } from "react";
import { TeacherListing, TeacherListingSkeleton } from "@/components/site/teacher-listing";
import { loadCatalog } from "@/server/catalog";
import { getCatalog } from "@/server/site";

// SEO için kademe ve kademe+ders sayfaları: /ozel-ders/lise, /ozel-ders/lise/matematik

export async function generateStaticParams() {
  const catalog = await loadCatalog();
  const subjectSlug = new Map(catalog.subjects.map((s) => [s.id, s.slug]));
  return catalog.levels.flatMap((level) => [
    { slug: [level.slug] },
    ...level.subjectIds.map((id) => ({ slug: [level.slug, subjectSlug.get(id)!] })),
  ]);
}

export async function generateMetadata({ params }: PageProps<"/ozel-ders/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalog();
  const level = catalog.levels.find((l) => l.slug === slug[0]);
  const subject = catalog.subjects.find((s) => s.slug === slug[1]);
  const name = [level?.name, subject?.name].filter(Boolean).join(" ");
  return {
    title: `${name} özel ders öğretmenleri`,
    description: `${name} için online ve yüz yüze özel ders, soru çözüm ve koçluk veren öğretmenleri karşılaştırın; puan ve yorumlara bakarak hemen randevu alın.`,
  };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/ozel-ders/[...slug]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<TeacherListingSkeleton />}>
        <CategoryListing params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CategoryListing({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  return (
    <TeacherListing
      searchParams={searchParams}
      preset={{ level: slug[0], ...(slug[1] ? { subject: slug[1] } : {}) }}
      basePath={`/ozel-ders/${slug.slice(0, 2).join("/")}`}
    />
  );
}

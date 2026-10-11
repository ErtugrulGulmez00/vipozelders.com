import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { fillPlaceholders, RichText } from "@/components/site/rich-text";
import { Card, Skeleton } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { db } from "@/server/db";
import { CACHE_TAGS, getSiteSettings } from "@/server/site";

async function getPage(slug: string) {
  "use cache";
  cacheTag(CACHE_TAGS.pages);
  cacheLife("hours");
  return db.page.findUnique({ where: { slug } });
}

export async function generateStaticParams() {
  const pages = await db.page.findMany({ where: { isPublished: true }, select: { slug: true } });
  return pages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps<"/sayfa/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  return { title: page?.title ?? "Sayfa bulunamadı" };
}

export default function ContentPage({ params }: PageProps<"/sayfa/[slug]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <PageContent params={params} />
      </Suspense>
    </div>
  );
}

async function PageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPage(slug), getSiteSettings()]);
  if (!page || !page.isPublished) notFound();
  return (
    <Card className="p-6 sm:p-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{page.title}</h1>
      <p className="mt-2 text-xs text-slate-400">Son güncelleme: {formatDate(page.updatedAt)}</p>
      <div className="mt-6">
        <RichText content={fillPlaceholders(page.content, settings)} />
      </div>
    </Card>
  );
}

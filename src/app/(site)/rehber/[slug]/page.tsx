import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RichText } from "@/components/site/rich-text";
import { LinkButton } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { publishedPost, readingMinutes } from "@/server/blog";
import { db } from "@/server/db";
import { uploadUrl } from "@/server/storage";

export async function generateStaticParams() {
  const posts = await db.blogPost.findMany({ where: { isPublished: true }, select: { slug: true } });
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: "ornek" }];
}

export async function generateMetadata({ params }: PageProps<"/rehber/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) return { title: "Yazı bulunamadı", robots: { index: false } };
  const cover = uploadUrl(post.coverKey);
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: { type: "article", title: post.title, description: post.excerpt ?? undefined, ...(cover ? { images: [cover] } : {}) },
  };
}

export default function BlogPostPage({ params }: PageProps<"/rehber/[slug]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Post params={params} />
      </Suspense>
    </div>
  );
}

async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await publishedPost(slug);
  if (!post) notFound();
  const cover = uploadUrl(post.coverKey);
  const date = post.publishedAt ?? post.updatedAt;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: date.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: { "@type": "Organization", name: post.authorName ?? "Pi Kampüs" },
  };
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />
      <Link href="/rehber" className="text-sm text-brand-700 hover:underline">
        ← Rehber
      </Link>
      <p className="mt-4 text-xs font-semibold text-brand-700">
        {post.category ?? "Rehber"} · {formatDate(date)} · {readingMinutes(post.content)} dk okuma
      </p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{post.title}</h1>
      {post.excerpt ? <p className="mt-3 text-lg text-slate-600">{post.excerpt}</p> : null}
      {cover ? <Image src={cover} alt="" width={1200} height={600} unoptimized className="mt-6 aspect-[2/1] w-full rounded-2xl object-cover" /> : null}
      <Card className="mt-6 p-6 sm:p-8">
        <RichText content={post.content} />
        {post.authorName ? <p className="mt-6 text-sm text-slate-500">Yazan: {post.authorName}</p> : null}
      </Card>
      <Card className="mt-6 flex flex-col items-start gap-3 border-brand-200 bg-brand-50/60 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-slate-900">Doğru öğretmeni birlikte bulalım</p>
          <p className="text-sm text-slate-600">Onaylı öğretmenler, net fiyatlar; öğretmen onaylamazsa ücretin tamamı iade.</p>
        </div>
        <LinkButton href="/ogretmenler">Öğretmenleri incele</LinkButton>
      </Card>
    </article>
  );
}

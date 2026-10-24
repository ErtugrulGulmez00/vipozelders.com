import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { publishedPosts } from "@/server/blog";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Rehber: LGS, YKS ve ders çalışma üzerine yazılar",
  description: "Veliler ve öğrenciler için sınav hazırlığı, ders çalışma ve özel ders üzerine pratik yazılar.",
};

export default function BlogIndexPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm font-semibold text-brand-700">Rehber</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Veliler ve öğrenciler için rehber</h1>
      <p className="mt-3 max-w-2xl text-slate-600">Sınav hazırlığı, ders çalışma düzeni ve doğru öğretmeni seçme üzerine öğretmenlerimizin önerileri.</p>
      <Suspense fallback={<Skeleton className="mt-8 h-64 rounded-2xl" />}>
        <PostList />
      </Suspense>
    </div>
  );
}

async function PostList() {
  const posts = await publishedPosts();
  if (!posts.length) {
    return (
      <div className="mt-8">
        <EmptyState icon={<Newspaper className="size-8" />} title="Yazılar çok yakında" description="İlk rehber yazılarımız hazırlanıyor." />
      </div>
    );
  }
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2">
      {posts.map((post) => {
        const cover = uploadUrl(post.coverKey);
        return (
          <Link key={post.slug} href={`/rehber/${post.slug}`} className="group">
            <Card className="h-full overflow-hidden transition group-hover:border-brand-300 group-hover:shadow-md">
              {cover ? <Image src={cover} alt="" width={800} height={400} unoptimized className="aspect-[2/1] w-full object-cover" /> : null}
              <div className="p-5">
                <p className="text-xs font-semibold text-brand-700">
                  {post.category ?? "Rehber"} · {formatDate(post.publishedAt ?? post.updatedAt)}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900 group-hover:text-brand-700">{post.title}</h2>
                {post.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{post.excerpt}</p> : null}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

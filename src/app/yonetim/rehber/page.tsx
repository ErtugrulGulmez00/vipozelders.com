import { Newspaper, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Rehber yazıları" };

export default async function AdminBlogPage() {
  const posts = await db.blogPost.findMany({ orderBy: { updatedAt: "desc" }, take: 200, select: { id: true, title: true, slug: true, category: true, isPublished: true, updatedAt: true } });
  return (
    <>
      <PageHeader
        title="Rehber yazıları"
        description="Veli ve öğrencilere yönelik yazılar sitede /rehber bölümünde yayınlanır ve Google'a bildirilir."
        actions={
          <LinkButton href="/yonetim/rehber/yeni">
            <Plus className="size-4" aria-hidden /> Yeni yazı
          </LinkButton>
        }
      />
      {posts.length === 0 ? (
        <Card>
          <EmptyState icon={<Newspaper className="size-8" />} title="Henüz yazı yok" description="İlk yazı için “LGS'ye kaç ay kala özel ders alınmalı?” gibi velilerin aradığı bir soru seçin." />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {posts.map((p) => (
            <Link key={p.id} href={`/yonetim/rehber/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
              <span>
                <span className="block font-medium text-slate-900">{p.title}</span>
                <span className="block text-xs text-slate-500">
                  /rehber/{p.slug}
                  {p.category ? ` · ${p.category}` : ""} · {formatCompact(p.updatedAt)}
                </span>
              </span>
              <Badge tone={p.isPublished ? "green" : "slate"}>{p.isPublished ? "Yayında" : "Taslak"}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

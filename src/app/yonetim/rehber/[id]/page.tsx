import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "Rehber yazısı" };

export default async function EditBlogPostPage({ params }: PageProps<"/yonetim/rehber/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const post = id === "yeni" ? null : await db.blogPost.findUnique({ where: { id } });
  if (id !== "yeni" && !post) notFound();
  return (
    <>
      <Link href="/yonetim/rehber" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Rehber yazıları
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{post ? post.title : "Yeni yazı"}</h1>
        {post?.isPublished ? (
          <Link href={`/rehber/${post.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
            Görüntüle <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      <Card>
        <CardBody className="p-6">
          <PostForm post={post ?? undefined} />
        </CardBody>
      </Card>
    </>
  );
}

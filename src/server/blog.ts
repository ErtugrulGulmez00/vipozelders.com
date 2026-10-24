import { cacheLife, cacheTag } from "next/cache";
import { db } from "./db";
import { CACHE_TAGS } from "./site";

// Rehber (blog) yazıları. Yayındaki yazılar önbellekten okunur; yönetimden kaydedilince önbellek yenilenir.

export async function publishedPosts(limit = 60) {
  "use cache";
  cacheTag(CACHE_TAGS.blog);
  cacheLife("hours");
  return db.blogPost.findMany({
    where: { isPublished: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: { slug: true, title: true, excerpt: true, category: true, coverKey: true, publishedAt: true, updatedAt: true },
  });
}

export async function publishedPost(slug: string) {
  "use cache";
  cacheTag(CACHE_TAGS.blog);
  cacheLife("hours");
  return db.blogPost.findFirst({ where: { slug, isPublished: true } });
}

/** Okuma süresi (dakika), Türkçe ortalama ~200 kelime/dk. */
export function readingMinutes(content: string): number {
  return Math.max(1, Math.round(content.split(/\s+/).filter(Boolean).length / 200));
}

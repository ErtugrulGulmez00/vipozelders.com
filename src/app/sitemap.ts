import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { loadCatalog } from "@/server/catalog";
import { listPublicCenters } from "@/server/center/public";
import { db } from "@/server/db";

async function sitemapData() {
  "use cache";
  cacheLife("hours");
  const [catalog, teachers, pages, centers] = await Promise.all([
    loadCatalog(),
    db.teacherProfile.findMany({ where: { status: "PUBLISHED", user: { status: "ACTIVE" } }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    listPublicCenters(null),
  ]);
  return { catalog, teachers, pages, centers };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { catalog, teachers, pages, centers } = await sitemapData();
  const subjectSlug = new Map(catalog.subjects.map((s) => [s.id, s.slug]));

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ogretmenler`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ogretmen-ol`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/kurumlar-icin`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/kurumlar`, changeFrequency: "weekly", priority: 0.5 },
    ...centers.map((c) => ({ url: `${base}/kurumlar/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...catalog.levels.flatMap((level) => [
      { url: `${base}/ozel-ders/${level.slug}`, changeFrequency: "daily" as const, priority: 0.8 },
      ...level.subjectIds.map((id) => ({ url: `${base}/ozel-ders/${level.slug}/${subjectSlug.get(id)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ]),
    ...teachers.map((t) => ({ url: `${base}/ogretmen/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...pages.map((p) => ({ url: `${base}/sayfa/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}

import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { loadCatalog } from "@/server/catalog";
import { listPublicCenters } from "@/server/center/public";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";

async function sitemapData() {
  "use cache";
  cacheLife("hours");
  const [catalog, teachers, pages, centers, groups, posts, settings] = await Promise.all([
    loadCatalog(),
    // Aktif dersi olmayan profil boş ders bölümüyle açılır; arama motoruna gönderilmez
    db.teacherProfile.findMany({ where: { status: "PUBLISHED", user: { status: "ACTIVE" }, offerings: { some: { isActive: true } } }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    listPublicCenters(null),
    // Kayıt alan, herkese açık grup dersleri
    db.groupCourse.findMany({ where: { status: "OPEN", isPublic: true, teacher: { status: "PUBLISHED" } }, select: { code: true, updatedAt: true } }),
    db.blogPost.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    loadSettings(),
  ]);
  return { catalog, teachers, pages, centers, groups: settings.groupsEnabled ? groups : null, posts };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const { catalog, teachers, pages, centers, groups, posts } = await sitemapData();
  const subjectSlug = new Map(catalog.subjects.map((s) => [s.id, s.slug]));

  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ozel-ders`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ogretmenler`, changeFrequency: "daily", priority: 0.9 },
    ...(groups ? [{ url: `${base}/grup-dersleri`, changeFrequency: "daily" as const, priority: 0.8 }] : []),
    ...(groups ?? []).map((g) => ({ url: `${base}/grup-dersleri/${g.code}`, lastModified: g.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    { url: `${base}/rehber`, changeFrequency: "weekly", priority: 0.7 },
    ...posts.map((p) => ({ url: `${base}/rehber/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${base}/ogretmen-ol`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/nasil-calisir`, changeFrequency: "monthly", priority: 0.6 },
    ...["ozel-ders", "etut-merkezi"].map((g) => ({ url: `${base}/nasil-calisir/${g}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${base}/kurumlar-icin`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/pi-koc`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/kurumlar`, changeFrequency: "weekly", priority: 0.5 },
    ...centers.map((c) => ({ url: `${base}/kurumlar/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...catalog.levels.flatMap((level) => [
      { url: `${base}/ozel-ders/${level.slug}`, changeFrequency: "daily" as const, priority: 0.8 },
      ...level.subjectIds.map((id) => ({ url: `${base}/ozel-ders/${level.slug}/${subjectSlug.get(id)}`, changeFrequency: "daily" as const, priority: 0.7 })),
    ]),
    ...teachers.map((t) => ({ url: `${base}/ogretmen/${t.slug}`, lastModified: t.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    // "Nasıl çalışır" yazısı /nasil-calisir/ozel-ders'e yönlenir (next.config)
    ...pages.filter((p) => p.slug !== "nasil-calisir").map((p) => ({ url: `${base}/sayfa/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}

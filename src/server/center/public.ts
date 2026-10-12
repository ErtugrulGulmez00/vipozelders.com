import { cacheLife, cacheTag } from "next/cache";
import { centerAccess } from "@/lib/center/subscription";
import { db } from "../db";

// Herkese açık kurum rehberi ve vitrin sayfaları (önbellekli; kurum ayarları kaydedilince yenilenir).

export const CENTERS_CACHE_TAG = "centers";

const publicWhere = { isPublic: true, status: { not: "SUSPENDED" as const } };

function visible(center: { status: "TRIAL" | "ACTIVE" | "SUSPENDED"; trialEndsAt: Date | null; paidUntil: Date | null }) {
  const state = centerAccess(center).state;
  return state !== "expired" && state !== "suspended";
}

export async function listPublicCenters(cityId: number | null) {
  "use cache";
  cacheTag(CENTERS_CACHE_TAG);
  cacheLife("minutes");
  const centers = await db.center.findMany({
    where: { ...publicWhere, ...(cityId ? { cityId } : {}) },
    select: {
      slug: true,
      name: true,
      kind: true,
      description: true,
      logoKey: true,
      status: true,
      trialEndsAt: true,
      paidUntil: true,
      city: { select: { name: true } },
      district: { select: { name: true } },
      groups: { where: { isActive: true }, select: { targetExam: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });
  return centers.filter(visible).map((c) => ({
    slug: c.slug,
    name: c.name,
    kind: c.kind,
    description: c.description,
    logoKey: c.logoKey,
    city: c.city?.name ?? null,
    district: c.district?.name ?? null,
    programs: [...new Set(c.groups.map((g) => g.targetExam).filter((t): t is string => Boolean(t)))],
  }));
}

export async function publicCenterCities() {
  "use cache";
  cacheTag(CENTERS_CACHE_TAG);
  cacheLife("minutes");
  const rows = await db.center.findMany({ where: { ...publicWhere, cityId: { not: null } }, select: { city: { select: { id: true, name: true } } }, distinct: ["cityId"] });
  return rows
    .map((r) => r.city!)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export async function getPublicCenter(slug: string) {
  "use cache";
  cacheTag(CENTERS_CACHE_TAG);
  cacheLife("minutes");
  const center = await db.center.findUnique({
    where: { slug },
    select: {
      slug: true,
      name: true,
      kind: true,
      description: true,
      logoKey: true,
      phone: true,
      email: true,
      address: true,
      isPublic: true,
      status: true,
      trialEndsAt: true,
      paidUntil: true,
      city: { select: { name: true } },
      district: { select: { name: true } },
      groups: { where: { isActive: true }, select: { name: true, gradeName: true, targetExam: true }, orderBy: { name: "asc" } },
      _count: { select: { members: { where: { isActive: true } } } },
    },
  });
  if (!center || !center.isPublic || !visible(center)) return null;
  return center;
}

/** Kurum giriş sayfasında gösterilecek ad ve logo (askıdaki kurum için gösterilmez). */
export async function getCenterBranding(slug: string) {
  "use cache";
  cacheTag(CENTERS_CACHE_TAG);
  cacheLife("minutes");
  const center = await db.center.findUnique({ where: { slug }, select: { name: true, logoKey: true, status: true } });
  return center && center.status !== "SUSPENDED" ? { name: center.name, logoKey: center.logoKey } : null;
}

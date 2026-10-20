import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { fullName, normalizeSearch } from "@/lib/text";
import { db } from "./db";
import { weightedRating } from "./pricing";
import { uploadUrl } from "./storage";

export const SORT_OPTIONS = [
  { value: "onerilen", label: "Önerilen" },
  { value: "fiyat-artan", label: "Fiyat (artan)" },
  { value: "fiyat-azalan", label: "Fiyat (azalan)" },
  { value: "puan", label: "En yüksek puan" },
  { value: "yorum", label: "En çok yorum" },
  { value: "ders", label: "En çok ders veren" },
  { value: "yeni", label: "En yeni" },
] as const;

export const TIME_OPTIONS = [
  { value: "hafta-ici-gunduz", label: "Hafta içi gündüz" },
  { value: "hafta-ici-aksam", label: "Hafta içi akşam" },
  { value: "hafta-sonu", label: "Hafta sonu" },
] as const;

export type TeacherSearchParams = {
  level?: string;
  subject?: string;
  service?: string;
  mode?: string;
  city?: string;
  district?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
  gender?: string;
  time?: string;
  verified?: string;
  /** "1": yalnızca ücretsiz tanışma sunanlar */
  intro?: string;
  q?: string;
  sort?: string;
  page?: string;
};

export type TeacherCard = {
  userId: string;
  slug: string;
  name: string;
  headline: string | null;
  photoUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedLessons: number;
  experienceYears: number;
  cityName: string | null;
  offersOnline: boolean;
  offersInPerson: boolean;
  /** Ücretsiz 15 dk tanışma görüşmesi */
  offersIntro: boolean;
  /** Yeni katılan, henüz az yorumu olan öğretmen ("Yeni" rozeti; önerilen sıralamada öne alınır) */
  isNew: boolean;
  verified: boolean;
  featured: boolean;
  minHourlyPrice: number;
  subjects: string[];
  avgResponseMinutes: number | null;
};

const PAGE_SIZE = 12;
const NEW_TEACHER_DAYS = 45;

/** Son 45 günde yayına alınmış ve 3'ten az yorumu olan öğretmen "yeni" sayılır. */
export function isNewTeacher(row: { publishedAt: Date | null; createdAt: Date; ratingCount: number }, now = new Date()): boolean {
  const since = (row.publishedAt ?? row.createdAt).getTime();
  return row.ratingCount < 3 && now.getTime() - since < NEW_TEACHER_DAYS * 86_400_000;
}

function int(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Vitrindeki öğretmen arama ve sıralama. */
export async function searchTeachers(params: TeacherSearchParams) {
  const [level, subject, service, city] = await Promise.all([
    params.level ? db.level.findUnique({ where: { slug: params.level } }) : null,
    params.subject ? db.subject.findUnique({ where: { slug: params.subject } }) : null,
    params.service ? db.serviceType.findUnique({ where: { slug: params.service } }) : null,
    params.city ? db.city.findUnique({ where: { slug: params.city } }) : null,
  ]);
  const district = city && params.district
    ? await db.district.findUnique({ where: { cityId_slug: { cityId: city.id, slug: params.district } } })
    : null;

  const minPrice = int(params.minPrice);
  const maxPrice = int(params.maxPrice);
  const offeringWhere: Prisma.TeacherOfferingWhereInput = {
    isActive: true,
    ...(level ? { levelId: level.id } : {}),
    ...(subject ? { subjectId: subject.id } : {}),
    ...(service ? { serviceTypeId: service.id } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { hourlyPrice: { ...(minPrice !== undefined ? { gte: minPrice * 100 } : {}), ...(maxPrice !== undefined ? { lte: maxPrice * 100 } : {}) } }
      : {}),
  };

  const and: Prisma.TeacherProfileWhereInput[] = [
    { status: "PUBLISHED", user: { status: "ACTIVE" } },
    { offerings: { some: offeringWhere } },
  ];

  const inPersonCity = params.mode !== "online" && city;
  if (params.mode === "online") and.push({ offersOnline: true });
  if (params.mode === "yuz-yuze" || inPersonCity) and.push({ offersInPerson: true });
  if (inPersonCity) {
    and.push({
      OR: [
        { serviceDistricts: { some: { district: district ? { id: district.id } : { cityId: city.id } } } },
        { serviceDistricts: { none: {} }, cityId: city.id, ...(district ? { districtId: district.id } : {}) },
      ],
    });
  }
  if (params.gender === "kadin") and.push({ gender: "FEMALE" });
  if (params.gender === "erkek") and.push({ gender: "MALE" });
  const minRating = int(params.rating);
  if (minRating) and.push({ ratingAvg: { gte: minRating }, ratingCount: { gt: 0 } });
  if (params.verified === "1") and.push({ verificationStatus: "VERIFIED" });
  if (params.intro === "1") and.push({ offersIntro: true, offersOnline: true });
  if (params.time === "hafta-ici-gunduz") and.push({ availabilityRules: { some: { weekday: { lte: 5 }, startMinute: { lt: 17 * 60 } } } });
  if (params.time === "hafta-ici-aksam") and.push({ availabilityRules: { some: { weekday: { lte: 5 }, endMinute: { gt: 17 * 60 } } } });
  if (params.time === "hafta-sonu") and.push({ availabilityRules: { some: { weekday: { gte: 6 } } } });
  const q = params.q ? normalizeSearch(params.q) : "";
  if (q) and.push({ AND: q.split(" ").filter(Boolean).map((word) => ({ searchText: { contains: word } })) });

  const rows = await db.teacherProfile.findMany({
    where: { AND: and },
    include: {
      user: { select: { firstName: true, lastName: true } },
      city: { select: { name: true } },
      offerings: {
        where: offeringWhere,
        include: { subject: { select: { name: true } }, level: { select: { name: true } } },
      },
    },
  });

  const cards: TeacherCard[] = rows.map((row) => ({
    userId: row.userId,
    slug: row.slug,
    name: fullName(row.user),
    headline: row.headline,
    photoUrl: uploadUrl(row.photoKey),
    ratingAvg: row.ratingAvg,
    ratingCount: row.ratingCount,
    completedLessons: row.completedLessons,
    experienceYears: row.experienceYears,
    cityName: row.city?.name ?? null,
    offersOnline: row.offersOnline,
    offersInPerson: row.offersInPerson,
    offersIntro: row.offersIntro && row.offersOnline,
    isNew: isNewTeacher(row),
    verified: row.verificationStatus === "VERIFIED",
    featured: row.isFeatured,
    minHourlyPrice: Math.min(...row.offerings.map((o) => o.hourlyPrice)),
    subjects: [...new Set(row.offerings.map((o) => o.subject.name))].slice(0, 4),
    avgResponseMinutes: row.avgResponseMinutes,
  }));

  const createdAt = new Map(rows.map((r) => [r.userId, r.publishedAt?.getTime() ?? r.createdAt.getTime()]));
  const score = (c: TeacherCard) =>
    (c.featured ? 1 : 0) * 10 + weightedRating(c.ratingAvg, c.ratingCount) + Math.log10(c.completedLessons + 1) * 0.3 + (c.verified ? 0.2 : 0) + (c.isNew ? 0.25 : 0) + (c.offersIntro ? 0.1 : 0);

  const sorters: Record<string, (a: TeacherCard, b: TeacherCard) => number> = {
    "fiyat-artan": (a, b) => a.minHourlyPrice - b.minHourlyPrice,
    "fiyat-azalan": (a, b) => b.minHourlyPrice - a.minHourlyPrice,
    puan: (a, b) => weightedRating(b.ratingAvg, b.ratingCount) - weightedRating(a.ratingAvg, a.ratingCount),
    yorum: (a, b) => b.ratingCount - a.ratingCount,
    ders: (a, b) => b.completedLessons - a.completedLessons,
    yeni: (a, b) => (createdAt.get(b.userId) ?? 0) - (createdAt.get(a.userId) ?? 0),
    onerilen: (a, b) => score(b) - score(a),
  };
  cards.sort(sorters[params.sort ?? "onerilen"] ?? sorters.onerilen);

  const total = cards.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, int(params.page) ?? 1), pageCount);
  return {
    items: cards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total,
    page,
    pageCount,
    resolved: { level, subject, service, city, district },
  };
}

export async function featuredTeachers(limit = 6): Promise<TeacherCard[]> {
  const result = await searchTeachers({ sort: "onerilen" });
  return result.items.slice(0, limit);
}

export const TEACHERS_CACHE_TAG = "teachers";

/** Öğretmen profil verisi (yayın durumundan bağımsız; görünürlük kararı sayfada verilir). */
export async function getTeacherProfileBySlug(slug: string) {
  const teacher = await db.teacherProfile.findUnique({
    where: { slug },
    include: {
      user: { select: { firstName: true, lastName: true, status: true } },
      city: true,
      district: true,
      serviceDistricts: { include: { district: { include: { city: true } } } },
      offerings: {
        where: { isActive: true },
        include: { level: true, subject: true, serviceType: true },
        orderBy: [{ level: { sortOrder: "asc" } }, { hourlyPrice: "asc" }],
      },
      reviews: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { student: { select: { firstName: true, lastName: true } }, booking: { select: { subjectName: true, levelName: true } } },
      },
    },
  });
  return teacher;
}

export type PublicTeacher = NonNullable<Awaited<ReturnType<typeof getTeacherProfileBySlug>>>;

export function isTeacherPublic(teacher: { status: string; user: { status: string } }): boolean {
  return teacher.status === "PUBLISHED" && teacher.user.status === "ACTIVE";
}

/** Sayfa başlığı için önbellekli özet (profil güncellenince "teachers" etiketiyle yenilenir). */
export async function getTeacherMeta(slug: string) {
  "use cache";
  cacheTag(TEACHERS_CACHE_TAG);
  cacheLife("minutes");
  const teacher = await db.teacherProfile.findUnique({
    where: { slug },
    select: {
      status: true,
      headline: true,
      user: { select: { firstName: true, lastName: true, status: true } },
      offerings: { where: { isActive: true }, select: { subject: { select: { name: true } } } },
    },
  });
  if (!teacher || !isTeacherPublic(teacher)) return null;
  return {
    name: fullName(teacher.user),
    headline: teacher.headline,
    subjects: [...new Set(teacher.offerings.map((o) => o.subject.name))].slice(0, 3),
  };
}

/** Profilin yayına alınabilmesi için eksikler. */
export async function profileChecklist(teacherId: string) {
  const teacher = await db.teacherProfile.findUniqueOrThrow({
    where: { userId: teacherId },
    include: {
      _count: { select: { offerings: { where: { isActive: true } }, availabilityRules: true } },
    },
  });
  const items = [
    { key: "photo", label: "Profil fotoğrafı", done: Boolean(teacher.photoKey) },
    { key: "bio", label: "Hakkımda yazısı (en az 100 karakter)", done: (teacher.bio?.trim().length ?? 0) >= 100 },
    { key: "offerings", label: "En az bir ders ve fiyat", done: teacher._count.offerings > 0 },
    { key: "availability", label: "Haftalık müsaitlik takvimi", done: teacher._count.availabilityRules > 0 },
    { key: "mode", label: "Ders şekli (online veya yüz yüze)", done: teacher.offersOnline || teacher.offersInPerson },
    { key: "declaration", label: "Öğretmen beyanı", done: Boolean(teacher.statusDeclarationAt) },
  ];
  return { items, complete: items.every((i) => i.done), status: teacher.status };
}

/** Arama için ad, başlık ve derslerden sade metin üretir. */
export async function refreshTeacherSearchText(teacherId: string) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    include: {
      user: { select: { firstName: true, lastName: true } },
      offerings: { where: { isActive: true }, include: { subject: true, level: true, serviceType: true } },
    },
  });
  if (!teacher) return;
  const parts = [
    teacher.user.firstName,
    teacher.user.lastName,
    teacher.headline ?? "",
    teacher.education ?? "",
    ...teacher.offerings.flatMap((o) => [o.subject.name, o.level.name, o.serviceType.name]),
  ];
  await db.teacherProfile.update({
    where: { userId: teacherId },
    data: { searchText: normalizeSearch([...new Set(parts)].join(" ")) },
  });
}

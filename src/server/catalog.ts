import { db } from "./db";

/** Kademe, ders ve hizmet türleri (arama formları, profil düzenleme, admin ekranları). */
export async function loadCatalog(options: { includeInactive?: boolean } = {}) {
  const active = options.includeInactive ? {} : { isActive: true };
  const [levels, subjects, services] = await Promise.all([
    db.level.findMany({
      where: active,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        grades: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        subjects: { select: { subjectId: true } },
      },
    }),
    db.subject.findMany({ where: active, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.serviceType.findMany({ where: active, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const subjectIds = new Set(subjects.map((s) => s.id));
  return {
    levels: levels.map((level) => ({
      id: level.id,
      name: level.name,
      slug: level.slug,
      group: level.group,
      isActive: level.isActive,
      sortOrder: level.sortOrder,
      grades: level.grades.map((g) => ({ id: g.id, name: g.name })),
      subjectIds: level.subjects.map((s) => s.subjectId).filter((id) => subjectIds.has(id)),
    })),
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug, isActive: s.isActive, sortOrder: s.sortOrder })),
    services: services.map((s) => ({ id: s.id, name: s.name, slug: s.slug, description: s.description, isActive: s.isActive, sortOrder: s.sortOrder })),
  };
}

export type Catalog = Awaited<ReturnType<typeof loadCatalog>>;

export async function loadCities() {
  return db.city.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

export async function loadDistricts(cityId: number) {
  return db.district.findMany({ where: { cityId }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}

export const LEVEL_GROUP_LABELS: Record<string, string> = {
  SCHOOL: "Okul dersleri",
  EXAM: "Sınav hazırlık",
  OTHER: "Diğer",
};

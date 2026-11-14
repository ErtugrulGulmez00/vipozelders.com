import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  CHANCE_ORDER,
  compareProgramsByCutoff,
  goalKindForProgram,
  PLACEMENT_EXAMS,
  placementChance,
  type Chance,
  type PlacementExamName,
  type PlacementInput,
  type ProgramRow,
} from "@/lib/placement";
import { audit } from "./audit";
import { CenterError } from "./center/errors";
import { db } from "./db";

// Tercih robotu: program verisinin yüklenmesi, arama ve öğrencinin tercih listesi.

/** Yüklenen tabloyu (sınav, yıl) için ekler ya da günceller; kimlikler korunur (tercih listeleri bozulmaz). */
export async function upsertPrograms(adminId: string, exam: PlacementExamName, year: number, rows: ProgramRow[], removeMissing: boolean) {
  if (!rows.length) throw new CenterError("Aktarılacak satır yok.");
  if (year < 2015 || year > 2100) throw new CenterError("Yıl geçersiz.");
  const cols = ["id", "exam", "year", "code", "name", "institution", "faculty", "city", "district", "scoreType", "kind", "details", "quota", "placed", "minScore", "maxScore", "minRank", "percentile"] as const;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const tuples = part.map((r, j) => {
      const base = j * cols.length;
      values.push(`pp_${exam}_${year}_${r.code}`.slice(0, 80), exam, year, r.code, r.name, r.institution, r.faculty, r.city, r.district, r.scoreType, r.kind, r.details, r.quota, r.placed, r.minScore, r.maxScore, r.minRank, r.percentile);
      return `(${cols.map((_, k) => `$${base + k + 1}${k === 1 ? '::"PlacementExam"' : ""}`).join(", ")})`;
    });
    await db.$executeRawUnsafe(
      `INSERT INTO "PlacementProgram" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${tuples.join(", ")}
       ON CONFLICT ("exam", "year", "code") DO UPDATE SET ${cols
         .filter((c) => !["id", "exam", "year", "code"].includes(c))
         // Boş gelen alan var olanı silmez: kısmi dosya (ör. YÖK Atlas tercih listesi) yalnızca eksikleri doldurur
         .map((c) => `"${c}" = COALESCE(EXCLUDED."${c}", "PlacementProgram"."${c}")`)
         .join(", ")}`,
      ...values,
    );
  }
  let removed = 0;
  if (removeMissing) {
    const codes = rows.map((r) => r.code);
    removed = (await db.placementProgram.deleteMany({ where: { exam, year, code: { notIn: codes } } })).count;
  }
  await audit({ actorId: adminId, action: "placement.import", entityType: "PlacementProgram", entityId: `${exam}-${year}`, details: { rows: rows.length, removed } });
  return { count: rows.length, removed };
}

export async function deleteProgramYear(adminId: string, exam: PlacementExamName, year: number) {
  const { count } = await db.placementProgram.deleteMany({ where: { exam, year } });
  await audit({ actorId: adminId, action: "placement.delete", entityType: "PlacementProgram", entityId: `${exam}-${year}`, details: { count } });
  return count;
}

/** Yüklü veri özeti (yönetim) */
export async function programYears() {
  const groups = await db.placementProgram.groupBy({ by: ["exam", "year"], _count: { _all: true }, _max: { createdAt: true }, orderBy: [{ exam: "asc" }, { year: "desc" }] });
  return groups.map((g) => ({ exam: g.exam as PlacementExamName, year: g.year, count: g._count._all, updatedAt: g._max.createdAt }));
}

export async function latestYear(exam: PlacementExamName): Promise<number | null> {
  const row = await db.placementProgram.findFirst({ where: { exam }, orderBy: { year: "desc" }, select: { year: true } });
  return row?.year ?? null;
}

/** Filtre seçenekleri: iller, türler, üniversite türleri */
export async function programFacets(exam: PlacementExamName, year: number) {
  const [cities, types, kinds] = await Promise.all([
    db.placementProgram.groupBy({ by: ["city"], where: { exam, year }, orderBy: { city: "asc" } }),
    db.placementProgram.groupBy({ by: ["scoreType"], where: { exam, year }, orderBy: { scoreType: "asc" } }),
    db.placementProgram.groupBy({ by: ["kind"], where: { exam, year, kind: { not: null } }, orderBy: { kind: "asc" } }),
  ]);
  return { cities: cities.map((c) => c.city), types: types.map((t) => t.scoreType), kinds: kinds.map((k) => k.kind!).filter(Boolean) };
}

export type ProgramFilters = { scoreType?: string; city?: string; kind?: string; q?: string; chances?: Chance[] };

const PROGRAM_SELECT = {
  id: true,
  code: true,
  name: true,
  institution: true,
  faculty: true,
  city: true,
  district: true,
  scoreType: true,
  kind: true,
  details: true,
  quota: true,
  placed: true,
  minScore: true,
  maxScore: true,
  minRank: true,
  percentile: true,
} satisfies Prisma.PlacementProgramSelect;

export type PlacementProgramView = Prisma.PlacementProgramGetPayload<{ select: typeof PROGRAM_SELECT }>;

/** Puana göre uygun programlar: şansı hesaplanır, uzak kalanlar elenir, en iyi taban önce. */
export async function searchPrograms(exam: PlacementExamName, year: number, input: PlacementInput, filters: ProgramFilters, limit = 100) {
  const q = filters.q?.trim().slice(0, 80);
  // Uzak kalacak programları veritabanında ele (şans eşikleriyle aynı sınırlar; tabanı olmayanlar her zaman gelir)
  const bound: Prisma.PlacementProgramWhereInput =
    exam === "YKS" && input.rank
      ? { OR: [{ minRank: { gte: Math.floor(input.rank / 1.5) } }, { minRank: null }] }
      : exam === "LGS" && input.percentile
        ? { OR: [{ percentile: { gte: input.percentile / 1.6 } }, { percentile: null }] }
        : input.score !== null
          ? { OR: [{ minScore: { lte: input.score + (exam === "YKS" ? 20 : 15) } }, { minScore: null }] }
          : {};
  const where: Prisma.PlacementProgramWhereInput = {
    exam,
    year,
    AND: [bound],
    ...(filters.scoreType ? { scoreType: filters.scoreType } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.kind ? { kind: filters.kind } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { institution: { contains: q, mode: "insensitive" } },
            { district: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  // Tek il / tür seçilmeden bütün Türkiye ~25 bin program: bellekte süzmek için üst sınır
  const programs = await db.placementProgram.findMany({ where, select: PROGRAM_SELECT, take: 30_000 });
  const wanted = new Set(filters.chances?.length ? filters.chances : CHANCE_ORDER);
  const scored = programs
    .map((p) => ({ program: p, chance: placementChance(exam, p, input) }))
    .filter((x): x is { program: PlacementProgramView; chance: Chance } => x.chance !== null && wanted.has(x.chance))
    .sort((a, b) => compareProgramsByCutoff(a.program, b.program));
  const counts = Object.fromEntries(CHANCE_ORDER.map((c) => [c, 0])) as Record<Chance, number>;
  for (const x of programs) {
    const c = placementChance(exam, x, input);
    if (c) counts[c]++;
  }
  return { total: scored.length, results: scored.slice(0, limit), counts };
}

// ——— Öğrencinin tercih listesi ———

export async function placementList(centerId: string, studentId: string, exam: PlacementExamName) {
  const list = await db.centerPlacementList.findFirst({ where: { centerId, studentId, exam } });
  if (!list) return null;
  const programs = await db.placementProgram.findMany({ where: { id: { in: list.programIds } }, select: { ...PROGRAM_SELECT, year: true } });
  const byId = new Map(programs.map((p) => [p.id, p]));
  // Silinmiş program (veri yeniden yüklendiğinde) listeden düşer
  return { ...list, programs: list.programIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)) };
}

async function studentOrThrow(centerId: string, studentId: string) {
  const s = await db.centerStudent.findFirst({ where: { id: studentId, centerId }, select: { id: true } });
  if (!s) throw new CenterError("Öğrenci bulunamadı.");
}

type ListInput = PlacementInput & { scoreType: string | null };

export async function addToPlacementList(centerId: string, studentId: string, exam: PlacementExamName, programId: string, input: ListInput) {
  await studentOrThrow(centerId, studentId);
  const program = await db.placementProgram.findFirst({ where: { id: programId, exam }, select: { id: true } });
  if (!program) throw new CenterError("Program bulunamadı.");
  const max = PLACEMENT_EXAMS[exam].listMax;
  const existing = await db.centerPlacementList.findUnique({ where: { studentId_exam: { studentId, exam } } });
  const ids = existing?.programIds ?? [];
  if (ids.includes(programId)) return;
  if (ids.length >= max) throw new CenterError(`${PLACEMENT_EXAMS[exam].label} tercih listesinde en fazla ${max} tercih olur.`);
  const data = { programIds: [...ids, programId], score: input.score, rank: input.rank, percentile: input.percentile, scoreType: input.scoreType };
  await db.centerPlacementList.upsert({ where: { studentId_exam: { studentId, exam } }, create: { centerId, studentId, exam, ...data }, update: data });
}

export async function changePlacementList(centerId: string, studentId: string, exam: PlacementExamName, programId: string, op: "up" | "down" | "remove") {
  await studentOrThrow(centerId, studentId);
  const list = await db.centerPlacementList.findFirst({ where: { centerId, studentId, exam } });
  if (!list) return;
  const ids = [...list.programIds];
  const i = ids.indexOf(programId);
  if (i < 0) return;
  if (op === "remove") ids.splice(i, 1);
  else {
    const j = op === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  await db.centerPlacementList.update({ where: { id: list.id }, data: { programIds: ids } });
}

export async function savePlacementNote(centerId: string, studentId: string, exam: PlacementExamName, note: string | null) {
  await studentOrThrow(centerId, studentId);
  await db.centerPlacementList.upsert({
    where: { studentId_exam: { studentId, exam } },
    create: { centerId, studentId, exam, programIds: [], note },
    update: { note },
  });
}

// ——— Hedef okul / program ———

/** Listedeki programı öğrencinin hedefi yapar (deneme türüne göre tek hedef) ya da hedefi kaldırır. */
export async function setPlacementTarget(centerId: string, studentId: string, exam: PlacementExamName, programId: string, on: boolean) {
  await studentOrThrow(centerId, studentId);
  const program = await db.placementProgram.findFirst({ where: { id: programId, exam }, select: { code: true, scoreType: true } });
  if (!program) throw new CenterError("Program bulunamadı.");
  if (!on) {
    const goals = await db.centerStudentGoal.findMany({ where: { studentId, targetExam: exam, targetCode: program.code }, select: { id: true, sectionNets: true } });
    for (const g of goals) {
      // Yalnızca hedef okul için açılmış (net hedefi olmayan) kayıt silinir
      const empty = !Object.keys((g.sectionNets ?? {}) as Record<string, number>).length;
      if (empty) await db.centerStudentGoal.delete({ where: { id: g.id } });
      else await db.centerStudentGoal.update({ where: { id: g.id }, data: { targetExam: null, targetCode: null } });
    }
    return;
  }
  const kind = goalKindForProgram(exam, program.scoreType);
  await db.centerStudentGoal.upsert({
    where: { studentId_kind: { studentId, kind } },
    create: { studentId, kind, sectionNets: {}, targetExam: exam, targetCode: program.code },
    update: { targetExam: exam, targetCode: program.code },
  });
}

/** Hedef kodlarının en son yıldaki programları (yeni yıl yüklenince taban kendiliğinden güncellenir). */
export async function targetPrograms(targets: { exam: PlacementExamName; code: string }[]) {
  const rows = targets.length
    ? await db.placementProgram.findMany({
        where: { OR: targets.map((t) => ({ exam: t.exam, code: t.code })) },
        select: { exam: true, code: true, year: true, name: true, institution: true, faculty: true, city: true, district: true, scoreType: true, minScore: true, minRank: true, percentile: true },
        orderBy: { year: "desc" },
      })
    : [];
  const map = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!map.has(`${r.exam}|${r.code}`)) map.set(`${r.exam}|${r.code}`, r);
  return map;
}

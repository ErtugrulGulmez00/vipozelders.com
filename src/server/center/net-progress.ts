import "server-only";
import type { ExamKindName } from "@/lib/center/exams";
import { db } from "../db";

// Başlangıç–son net karşılaştırması: her deneme türünde (TYT, AYT, LGS…) öğrencinin ilk ve son denemesi, ders ders.

export type NetProgressSection = { name: string; first: number | null; last: number | null; change: number | null };
export type NetProgress = {
  kind: ExamKindName;
  count: number;
  first: { name: string; date: string; net: number };
  last: { name: string; date: string; net: number };
  change: number;
  sections: NetProgressSection[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const key = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** En az iki denemesi olan türler için ilk/son karşılaştırma (yalnızca bu kuruma ait denemeler). */
export async function studentNetProgress(centerId: string, studentId: string): Promise<NetProgress[]> {
  const results = await db.centerExamResult.findMany({
    where: { studentId, exam: { centerId } },
    select: { net: true, exam: { select: { name: true, kind: true, date: true } }, sections: { select: { net: true, section: { select: { name: true, order: true } } } } },
    orderBy: [{ exam: { date: "asc" } }, { createdAt: "asc" }],
  });
  const byKind = new Map<ExamKindName, typeof results>();
  for (const r of results) {
    const kind = r.exam.kind as ExamKindName;
    byKind.set(kind, [...(byKind.get(kind) ?? []), r]);
  }
  const out: NetProgress[] = [];
  for (const [kind, list] of byKind) {
    if (list.length < 2) continue;
    const first = list[0];
    const last = list[list.length - 1];
    const firstNets = new Map(first.sections.map((s) => [key(s.section.name), s.net]));
    const lastNets = new Map(last.sections.map((s) => [key(s.section.name), s.net]));
    // Ders sırası son denemeye göre; ilk denemede olup sonda olmayan ders sona eklenir
    const names = [...last.sections].sort((a, b) => a.section.order - b.section.order).map((s) => s.section.name);
    for (const s of [...first.sections].sort((a, b) => a.section.order - b.section.order)) if (!names.some((n) => key(n) === key(s.section.name))) names.push(s.section.name);
    out.push({
      kind,
      count: list.length,
      first: { name: first.exam.name, date: iso(first.exam.date), net: r2(first.net) },
      last: { name: last.exam.name, date: iso(last.exam.date), net: r2(last.net) },
      change: r2(last.net - first.net),
      sections: names.map((name) => {
        const a = firstNets.get(key(name)) ?? null;
        const b = lastNets.get(key(name)) ?? null;
        return { name, first: a === null ? null : r2(a), last: b === null ? null : r2(b), change: a === null || b === null ? null : r2(b - a) };
      }),
    });
  }
  return out;
}

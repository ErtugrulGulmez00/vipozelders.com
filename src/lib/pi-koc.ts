// Pi Koç: bireysel koçların öğrenci takip paneli. Kademeler site ayarından gelir: "öğrenci:aylık TL", virgülle ayrılmış.

export type CoachTier = { students: number; priceTl: number };

/** "3:299,5:449" → [{ students: 3, priceTl: 299 }, …]. Hatalı parçalar atlanır, aynı öğrenci sayısının sonuncusu geçerlidir. */
export function parseCoachTiers(text: string): CoachTier[] {
  const tiers = text
    .split(/[,\n]+/)
    .map((part) => part.trim().split(":").map((n) => Number(n.trim())))
    .filter(([students, price]) => Number.isInteger(students) && students > 0 && students <= 1000 && Number.isInteger(price) && price > 0 && price <= 1_000_000)
    .map(([students, priceTl]) => ({ students, priceTl }));
  const unique = new Map(tiers.map((t) => [t.students, t]));
  return [...unique.values()].sort((a, b) => a.students - b.students);
}

/** Öğrenci sınırına karşılık gelen aylık fiyat (özel bir sınır verilmişse null). */
export function coachPriceFor(tiers: CoachTier[], students: number): number | null {
  return tiers.find((t) => t.students === students)?.priceTl ?? null;
}

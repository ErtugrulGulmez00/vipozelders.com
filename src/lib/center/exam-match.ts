import { normalizeSearch } from "@/lib/text";

// PDF'teki öğrenciyi kurumdaki öğrenciyle eşleştirme. Öğrenciler optik formu özensiz doldurur
// (numara 0 / 12345, sınıf "8-XX", eksik ya da hatalı ad), bu yüzden numara tek başına yetmez.

export type MatchCandidate = { id: string; firstName: string; lastName: string; studentNumber: string | null; groups: string[] };
export type MatchInput = { name: string; number: string; className: string };
export type MatchConfidence = "alias" | "exact" | "number" | "suggested" | "none";
export type StudentMatch = { studentId: string | null; confidence: MatchConfidence; suggestions: { id: string; score: number }[] };

/** Bir sonraki denemede aynı kişiyi tanımak için PDF'teki ad + numara. */
export function aliasKey(input: { name: string; number: string }): string {
  return `${normalizeSearch(input.name)}|${input.number.trim().replace(/^0+(?=\d)/, "")}`;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

const tokenSimilarity = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/** 0-1 arası ad benzerliği; PDF'teki adın her parçası adayda aranır, adayın fazla parçası az cezalandırılır. */
export function nameSimilarity(pdfName: string, candidate: string): number {
  const a = normalizeSearch(pdfName).split(" ").filter(Boolean);
  const b = normalizeSearch(candidate).split(" ").filter(Boolean);
  if (!a.length || !b.length) return 0;
  const side = (from: string[], to: string[]) => from.reduce((t, x) => t + Math.max(...to.map((y) => tokenSimilarity(x, y))), 0) / from.length;
  return 0.8 * side(a, b) + 0.2 * side(b, a);
}

/** Optik formda sık görülen anlamsız numaralar (0, 12345, 1111…) ve PDF'te birden fazla kişide geçen numaralar. */
export function junkNumbers(inputs: MatchInput[]): Set<string> {
  const seen = new Map<string, number>();
  for (const i of inputs) {
    const n = i.number.trim().replace(/^0+(?=\d)/, "");
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  const junk = new Set<string>();
  for (const [n, count] of seen) {
    if (count > 1 || !n || /^0+$/.test(n) || /^(\d)\1+$/.test(n) || "1234567890".includes(n) || "9876543210".includes(n)) junk.add(n);
  }
  return junk;
}

const AUTO_SCORE = 0.85;
const SUGGEST_SCORE = 0.55;

export function matchStudents(inputs: MatchInput[], candidates: MatchCandidate[], aliases: Map<string, string>): StudentMatch[] {
  const junk = junkNumbers(inputs);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const byNumber = new Map(candidates.filter((c) => c.studentNumber).map((c) => [c.studentNumber!.replace(/^0+(?=\d)/, ""), c]));
  const byName = new Map<string, MatchCandidate[]>();
  for (const c of candidates) {
    const key = normalizeSearch(`${c.firstName} ${c.lastName}`);
    byName.set(key, [...(byName.get(key) ?? []), c]);
  }
  const classOf = (s: string) => normalizeSearch(s).replace(/\s/g, "");

  const raw = inputs.map((input): StudentMatch & { score: number } => {
    const scored = candidates
      .map((c) => {
        let score = nameSimilarity(input.name, `${c.firstName} ${c.lastName}`);
        // Sınıf adı grup adında geçiyorsa küçük bir artı (8-A ↔ "8-A LGS")
        const cls = classOf(input.className);
        if (cls.length >= 2 && c.groups.some((g) => classOf(g).includes(cls))) score += 0.05;
        return { id: c.id, score: Math.min(1, Math.round(score * 1000) / 1000) };
      })
      .filter((s) => s.score >= SUGGEST_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const alias = aliases.get(aliasKey(input));
    if (alias && byId.has(alias)) return { studentId: alias, confidence: "alias", suggestions: scored, score: 3 };
    const exact = byName.get(normalizeSearch(input.name)) ?? [];
    if (exact.length === 1) return { studentId: exact[0].id, confidence: "exact", suggestions: scored, score: 2 };
    const number = input.number.trim().replace(/^0+(?=\d)/, "");
    const numbered = !junk.has(number) ? byNumber.get(number) : undefined;
    if (numbered && nameSimilarity(input.name, `${numbered.firstName} ${numbered.lastName}`) >= 0.5) {
      return { studentId: numbered.id, confidence: "number", suggestions: scored, score: 1.5 };
    }
    const [best, second] = scored;
    if (best && best.score >= AUTO_SCORE && (!second || best.score - second.score >= 0.08)) {
      return { studentId: best.id, confidence: "suggested", suggestions: scored, score: best.score };
    }
    return { studentId: null, confidence: "none", suggestions: scored, score: 0 };
  });

  // Aynı öğrenci iki satıra düştüyse güveni yüksek olan kalır.
  const order = raw.map((_, i) => i).sort((a, b) => raw[b].score - raw[a].score);
  const taken = new Set<string>();
  for (const i of order) {
    const m = raw[i];
    if (!m.studentId) continue;
    if (taken.has(m.studentId)) {
      m.studentId = null;
      m.confidence = "none";
    } else taken.add(m.studentId);
  }
  return raw.map(({ studentId, confidence, suggestions }) => ({ studentId, confidence, suggestions }));
}

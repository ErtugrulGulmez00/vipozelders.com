import { formatMinutes } from "./koc-format";

// Haftalık rapordan koça değerlendirme taslağı: (1) kurallı, yapay zekâsız özet; (2) yapay zekâya gidecek isimsiz veri.
// İkisi de yalnızca sayılardan üretilir; öğrenci adı, koç notu gibi serbest metin kullanılmaz.

export type SummaryInput = {
  solved: number;
  previousSolved: number;
  accuracy: number | null;
  activeDays: number;
  studyMinutes: number;
  subjects: { subject: string; solved: number; accuracy: number | null }[];
  plan: { done: number; total: number };
  exam: { kindLabel: string; net: number; change: number | null; inWeek: boolean } | null;
  goal: { kindLabel: string; targetNet: number; gap: number | null; target?: { minScore: number | null; last: number | null; gap: number | null } | null } | null;
  priorityTopics?: string[];
};

const pct = (x: number) => `%${Math.round(x * 100)}`;
const net = (x: number) => x.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

/** Sayıları düzgün Türkçe cümlelere döker. Yorum katmaz, yalnızca tespit yapar. */
export function ruleBasedSummary(d: SummaryInput): string {
  const out: string[] = [];

  if (d.solved > 0) {
    let s = `Bu hafta ${d.solved} soru çözdü`;
    if (d.previousSolved > 0) {
      const change = Math.round(((d.solved - d.previousSolved) / d.previousSolved) * 100);
      s += change >= 5 ? `, geçen haftaya göre %${change} daha fazla` : change <= -5 ? `, geçen haftaya göre %${-change} daha az` : `, geçen haftayla aynı düzeyde`;
    }
    out.push(d.accuracy !== null ? `${s}; doğruluk oranı ${pct(d.accuracy)}.` : `${s}.`);
  } else {
    out.push(d.previousSolved > 0 ? `Bu hafta soru kaydı girilmedi (geçen hafta ${d.previousSolved} soru).` : "Bu hafta soru kaydı girilmedi.");
  }

  // Doğruluğu hesaplanabilen, yeterli soru çözülmüş dersler
  const rated = d.subjects.filter((s) => s.accuracy !== null && s.solved >= 10) as { subject: string; solved: number; accuracy: number }[];
  if (rated.length >= 2) {
    const sorted = [...rated].sort((a, b) => b.accuracy - a.accuracy);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.accuracy - worst.accuracy >= 0.08) out.push(`En güçlü ders ${best.subject} (${pct(best.accuracy)}); ${worst.subject} doğruluğu ${pct(worst.accuracy)} ile en düşük, buna ağırlık vereceğiz.`);
    else out.push(`Derslerde doğruluk dengeli (${pct(worst.accuracy)}–${pct(best.accuracy)}).`);
  }

  if (d.plan.total > 0) {
    const ratio = d.plan.done / d.plan.total;
    const tail = ratio >= 0.85 ? "programa çok iyi uydu" : ratio >= 0.6 ? "programın büyük bölümünü uyguladı" : ratio > 0 ? "programın bir kısmında kaldı" : "programdaki görevleri işaretlemedi";
    out.push(`${d.plan.total} görevlik programın ${d.plan.done} tanesini tamamladı (${pct(ratio)}); ${tail}.`);
  }

  if (d.studyMinutes > 0) out.push(`Toplam çalışma süresi ${formatMinutes(d.studyMinutes)}, ${d.activeDays} gün çalıştı.`);
  else if (d.activeDays > 0) out.push(`Hafta içinde ${d.activeDays} gün çalışma kaydı var.`);

  if (d.exam) {
    let s = `${d.exam.inWeek ? "Bu haftaki" : "Son"} ${d.exam.kindLabel} denemesinde ${net(d.exam.net)} net yaptı`;
    if (d.exam.change !== null && d.exam.change !== 0) s += `, bir önceki denemeye göre ${net(Math.abs(d.exam.change))} net ${d.exam.change > 0 ? "artış" : "düşüş"}`;
    out.push(`${s}.`);
  }
  if (d.goal?.target && d.goal.target.last !== null && d.goal.target.gap !== null) {
    out.push(d.goal.target.gap > 0 ? `Hedef okulun tabanına ${net(d.goal.target.gap)} puan kaldı.` : "Son deneme puanı hedef okulun geçen yılki tabanının üstünde.");
  }
  if (d.goal && d.goal.gap !== null) {
    out.push(d.goal.gap === 0 ? `${d.goal.kindLabel} hedefi olan ${net(d.goal.targetNet)} nete ulaştı.` : `${d.goal.kindLabel} hedefine (${net(d.goal.targetNet)} net) ${net(d.goal.gap)} net kaldı.`);
  }
  if (d.priorityTopics?.length) out.push(`Önümüzdeki hafta önceliğimiz: ${d.priorityTopics.slice(0, 4).join(", ")}.`);

  return out.join(" ");
}

/** Yapay zekâya gidecek isimsiz veri metni (ad, kurum, serbest not yok). */
export function summaryFacts(d: SummaryInput, gradeName: string | null): string {
  const lines: string[] = [];
  if (gradeName) lines.push(`Sınıf: ${gradeName}`);
  lines.push(`Bu hafta çözülen soru: ${d.solved} (geçen hafta ${d.previousSolved})`);
  if (d.accuracy !== null) lines.push(`Genel doğruluk: ${pct(d.accuracy)}`);
  for (const s of d.subjects.slice(0, 8)) lines.push(`- ${s.subject}: ${s.solved} soru${s.accuracy !== null ? `, doğruluk ${pct(s.accuracy)}` : ""}`);
  if (d.plan.total) lines.push(`Program: ${d.plan.total} görevden ${d.plan.done} tamamlandı`);
  lines.push(`Çalışma süresi: ${d.studyMinutes ? formatMinutes(d.studyMinutes) : "girilmedi"}, aktif gün: ${d.activeDays}/7`);
  if (d.exam) lines.push(`${d.exam.inWeek ? "Bu haftaki" : "Son"} ${d.exam.kindLabel} denemesi: ${net(d.exam.net)} net${d.exam.change !== null ? ` (bir öncekine göre ${d.exam.change > 0 ? "+" : ""}${net(d.exam.change)})` : ""}`);
  if (d.goal && d.goal.targetNet > 0) lines.push(`Hedef: ${d.goal.kindLabel} ${net(d.goal.targetNet)} net${d.goal.gap !== null ? `, kalan ${net(d.goal.gap)} net` : ""}`);
  const t = d.goal?.target;
  if (t && t.minScore !== null) lines.push(`Hedef okulun geçen yılki taban puanı: ${net(t.minScore)}${t.last !== null ? `; son deneme puanı ${net(t.last)} (${t.gap !== null && t.gap > 0 ? `tabana ${net(t.gap)} puan kaldı` : "tabanın üstünde"})` : "; deneme puanı girilmemiş"}`);
  if (d.priorityTopics?.length) lines.push(`Koçun belirlediği öncelikli konular: ${d.priorityTopics.slice(0, 6).join(", ")}`);
  return lines.join("\n");
}

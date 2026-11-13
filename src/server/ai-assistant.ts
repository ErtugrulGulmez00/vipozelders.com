import "server-only";
import { EXAM_PRESETS, type ExamKindName } from "@/lib/center/exams";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, toLocalDateString } from "@/lib/dates";
import { ruleBasedSummary, summaryFacts, type SummaryInput } from "@/lib/koc-summary";
import { aiConfigured, aiText } from "./ai";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import type { CenterContext } from "./center/context";
import { weekStartOf } from "./center/resources";
import { db } from "./db";
import { kocStudentOrThrow } from "./koc";
import { freeAiLeft, weeklyReportData } from "./koc-report";

// Öğretmene yardımcı yapay zekâ asistanı: seçili öğrencinin haftası ve son haftalarından yorum, özet ya da yol haritası.
// Yalnızca öğretmen görür, kaydedilmez. Yapay zekâya isimsiz sayılar gider (ad, kurum, serbest not yok); yanıt
// gelmezse kurallı metin döner.

export type AssistantKind = "comment" | "summary" | "roadmap";
export const ASSISTANT_KINDS: AssistantKind[] = ["comment", "summary", "roadmap"];
export type AssistantResult = { text: string; source: "ai" | "rule"; notice?: string };

/** Asistan hızlı yanıt ister: önce hızlı model (OPENROUTER_ASSISTANT_MODELS ile değişir) */
function assistantModels(): string[] | undefined {
  const list = (process.env.OPENROUTER_ASSISTANT_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (list.length) return list;
  return process.env.OPENROUTER_MODELS ? undefined : ["nvidia/nemotron-3.5-super-vl:free", "nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free"];
}

/** Kurum başına günlük sınır (ücretsiz modellerin kotasını korur) */
const DAILY_LIMIT = { coach: 40, center: 120 };

const COMMON = [
  "Sen deneyimli bir eğitim koçusun ve bir öğretmene, öğrencisi hakkında yardımcı not yazıyorsun.",
  "Türkçe yaz, öğretmene 'siz' diye hitap et. Yalnızca verilen sayılara dayan; sayı, konu ya da olay uydurma.",
  "Öğrencinin adını bilmiyorsun, 'öğrenci' de. Emoji, selamlama ve imza kullanma. Sayıları doğal yaz.",
].join(" ");

const PROMPTS: Record<AssistantKind, string> = {
  comment: `${COMMON} Bu haftaya dair kısa bir değerlendirme yaz: en fazla 5 cümle. Önce iyi giden şeyi, sonra dikkat edilmesi gereken noktayı söyle; sonunda görüşmede öğrenciye sorulabilecek 1-2 soru öner.`,
  summary: `${COMMON} Haftanın özetini en fazla 6 kısa madde hâlinde yaz; her madde '- ' ile başlasın ve bir sayıya dayansın. Yorum yerine tespit yaz.`,
  roadmap: `${COMMON} Önümüzdeki 3-4 hafta için yol haritası yaz: 4-6 madde, her madde '- ' ile başlasın ve somut olsun (hangi ders, haftalık soru hedefi, deneme sıklığı, tekrar). Hedef net ile mevcut net arasındaki farkı ve zayıf dersleri öne al. Gerçekçi ol; verinin yetersiz olduğu yerde bunu söyle.`,
};

async function roadmapExtra(centerId: string, studentId: string, weekStart: string) {
  const from = addDaysToDateString(weekStart, -21);
  const [logs, exams] = await Promise.all([
    db.centerQuestionLog.findMany({ where: { studentId, date: { gte: dateStringToDbDate(from), lt: dateStringToDbDate(addDaysToDateString(weekStart, 7)) } }, select: { date: true, solved: true } }),
    db.centerExamResult.findMany({ where: { studentId, exam: { centerId } }, select: { net: true, exam: { select: { kind: true, date: true } } }, orderBy: { exam: { date: "desc" } }, take: 8 }),
  ]);
  const weeks = [0, 1, 2, 3].map((i) => {
    const start = addDaysToDateString(from, i * 7);
    const end = addDaysToDateString(start, 7);
    return logs.filter((l) => dbDateToString(l.date) >= start && dbDateToString(l.date) < end).reduce((t, l) => t + l.solved, 0);
  });
  const kind = exams[0]?.exam.kind as ExamKindName | undefined;
  const nets = kind ? exams.filter((e) => e.exam.kind === kind).slice(0, 6).reverse().map((e) => e.net) : [];
  return { weeks, kindLabel: kind ? EXAM_PRESETS[kind].label : null, nets };
}

function roadmapRule(d: SummaryInput, extra: Awaited<ReturnType<typeof roadmapExtra>>): string {
  const out: string[] = [];
  const rated = d.subjects.filter((s) => s.accuracy !== null && s.solved >= 10).sort((a, b) => a.accuracy! - b.accuracy!);
  if (rated[0]) out.push(`- ${rated[0].subject}: doğruluk %${Math.round(rated[0].accuracy! * 100)}; önümüzdeki 2 hafta konu tekrarı ve günde 20-30 soruyla öncelik verin.`);
  if (rated[1] && rated[1].accuracy! < 0.7) out.push(`- ${rated[1].subject}: doğruluk %${Math.round(rated[1].accuracy! * 100)}; haftada 3 gün kısa tekrar ekleyin.`);
  const avg = Math.round(extra.weeks.reduce((t, w) => t + w, 0) / 4);
  if (avg > 0) out.push(`- Son 4 haftada haftalık ortalama ${avg} soru; hedefi kademeli olarak ${Math.round(avg * 1.15)} soruya çıkarın.`);
  else out.push("- Soru kaydı az: önce her gün soru girilmesini alışkanlık hâline getirin.");
  if (d.plan.total && d.plan.done / d.plan.total < 0.7) out.push(`- Programın %${Math.round((d.plan.done / d.plan.total) * 100)}'i tamamlanmış; görev sayısını azaltıp uygulanabilir bir program kurun.`);
  if (d.activeDays < 5) out.push(`- Haftada ${d.activeDays} gün çalışılmış; en az 5 gün düzenli çalışma hedefleyin.`);
  if (d.goal && d.goal.gap) out.push(`- ${d.goal.kindLabel} hedefine ${d.goal.gap.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} net kaldı; iki haftada bir deneme ile ilerlemeyi ölçün.`);
  else if (extra.kindLabel) out.push(`- ${extra.kindLabel} denemelerini iki haftada bir düzenli girin; net gelişimini buradan izleyin.`);
  else out.push("- Henüz deneme girilmemiş: bir deneme sonucu girildiğinde yol haritası netleşir.");
  return out.join("\n");
}

function summaryRule(d: SummaryInput, grade: string | null): string {
  return summaryFacts(d, grade)
    .split("\n")
    .map((l) => (l.startsWith("- ") ? l : `- ${l}`))
    .join("\n");
}

export async function studentAssistant(ctx: CenterContext, studentId: string, kind: AssistantKind, now = new Date()): Promise<AssistantResult> {
  await kocStudentOrThrow(ctx, studentId);
  const weekStart = weekStartOf(toLocalDateString(now));
  const data = await weeklyReportData(ctx.center.id, studentId, weekStart);
  const input: SummaryInput = { ...data, priorityTopics: [...new Set(data.sessions.flatMap((s) => s.priorityTopics))] };
  const extra = kind === "roadmap" ? await roadmapExtra(ctx.center.id, studentId, weekStart) : null;
  const rule = kind === "comment" ? ruleBasedSummary(input) : kind === "summary" ? summaryRule(input, data.student.gradeName) : roadmapRule(input, extra!);
  const empty = data.solved === 0 && !data.plan.total && !data.studyMinutes && !data.exam && !(extra && extra.weeks.some(Boolean));
  if (empty) return { text: rule, source: "rule", notice: "Bu öğrenci için yeterli kayıt yok; soru, program ya da deneme girildikçe öneriler zenginleşir." };
  if (!aiConfigured()) return { text: rule, source: "rule" };

  // Pi Koç ücretsiz paket: ayda sınırlı hak (veli raporu taslağıyla ortak)
  const freeLeft = await freeAiLeft(ctx, now);
  if (freeLeft === 0) return { text: rule, source: "rule", notice: "Ücretsiz paketteki bu ayki yapay zekâ hakkınız kullanıldı; verilerden kurallı öneri yazıldı. Ücretli pakette asistan her gün kullanılabilir." };
  const limitKey = ctx.coach ? `ai-draft:${ctx.center.id}` : `ai-assist:${ctx.center.id}`;
  if ((await countRecentAttempts(limitKey, 86_400_000)) >= (ctx.coach ? DAILY_LIMIT.coach : DAILY_LIMIT.center)) return { text: rule, source: "rule", notice: "Bugünkü yapay zekâ sınırına ulaşıldı; verilerden kurallı öneri yazıldı." };
  await recordLoginAttempt(limitKey, null, false);

  const facts = [
    summaryFacts(input, data.student.gradeName),
    data.student.targetExam ? `Hedef sınav: ${data.student.targetExam}` : null,
    extra ? `Son 4 haftada haftalık çözülen soru (eskiden yeniye): ${extra.weeks.join(", ")}` : null,
    extra?.nets.length ? `Son ${extra.kindLabel} denemelerinin netleri (eskiden yeniye): ${extra.nets.map((n) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const text = await aiText({ system: PROMPTS[kind], prompt: facts, maxTokens: 2500, timeoutMs: 60_000, modelList: assistantModels() });
  const clean = text
    ?.replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[*•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
  if (!clean) return { text: rule, source: "rule", notice: "Yapay zekâ şu an yanıt vermedi; verilerden kurallı öneri yazıldı." };
  if (freeLeft !== null) await recordLoginAttempt(`ai-free:${ctx.center.id}`, null, false);
  return { text: clean, source: "ai", ...(freeLeft === 1 ? { notice: "Ücretsiz paketteki bu ayki yapay zekâ hakkınızı kullandınız." } : {}) };
}

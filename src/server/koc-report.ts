import "server-only";
import { EXAM_PRESETS, round2, type ExamKindName } from "@/lib/center/exams";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, isDateString, isoWeekday, minutesToTime, toLocalDateString, toLocalMinutes, WEEKDAY_NAMES } from "@/lib/dates";
import { coachPlan } from "@/lib/pi-koc";
import { ruleBasedSummary, summaryFacts } from "@/lib/koc-summary";
import { aiConfigured, aiText } from "./ai";
import { randomToken } from "./auth/password";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import type { CenterContext } from "./center/context";
import { CenterError } from "./center/errors";
import { messageGuardians } from "./center/messages";
import { weekStartOf } from "./center/resources";
import { db } from "./db";
import { kocStudentOrThrow, studentGoals } from "./koc";
import { monthStartOf } from "./koc-meeting-usage";
import { loadSettings } from "./settings";

// Pi Koç haftalık veli raporu: haftanın soru, doğruluk, program ve deneme özeti + koçun değerlendirmesi.
// Rapor her açılışta güncel veriden hesaplanır; kaydedilen yalnızca koçun notu ve paylaşım bağlantısıdır.

/** Paylaşım bağlantısının geçerlilik süresi (her paylaşımda yeniden başlar) */
export const REPORT_LINK_DAYS = 30;

export function reportWeek(value: unknown, today: string): string {
  return weekStartOf(typeof value === "string" && isDateString(value) ? value : today);
}

export async function weeklyReportData(centerId: string, studentId: string, weekStart: string) {
  const weekEnd = addDaysToDateString(weekStart, 7);
  const prevStart = addDaysToDateString(weekStart, -7);
  const range = (from: string, to: string) => ({ gte: dateStringToDbDate(from), lt: dateStringToDbDate(to) });
  const [student, logs, prevLogs, plan, sessions, results, goals, study] = await Promise.all([
    db.centerStudent.findFirstOrThrow({
      where: { id: studentId, centerId },
      select: { firstName: true, lastName: true, gradeName: true, targetExam: true, coachWeekday: true, coachMinute: true, center: { select: { name: true, phone: true } } },
    }),
    db.centerQuestionLog.findMany({ where: { studentId, date: range(weekStart, weekEnd) }, select: { date: true, subject: true, solved: true, correct: true, wrong: true } }),
    db.centerQuestionLog.aggregate({ where: { studentId, date: range(prevStart, weekStart) }, _sum: { solved: true } }),
    db.centerStudyPlanItem.findMany({ where: { studentId, date: range(weekStart, weekEnd) }, select: { subject: true, doneAt: true } }),
    // Veliye yalnızca "veli görsün" işaretli görüşme notları gider
    db.centerCoachingSession.findMany({ where: { studentId, date: range(weekStart, weekEnd) }, select: { date: true, held: true, notes: true, nextGoal: true, priorityTopics: true, visibleToParent: true }, orderBy: { date: "asc" } }),
    db.centerExamResult.findMany({
      where: { studentId, exam: { centerId, date: { lt: dateStringToDbDate(weekEnd) } } },
      select: { net: true, exam: { select: { name: true, kind: true, date: true } }, sections: { select: { net: true, section: { select: { name: true, questionCount: true, order: true } } } } },
      orderBy: { exam: { date: "desc" } },
      take: 12,
    }),
    studentGoals(centerId, studentId),
    db.centerStudySession.findMany({ where: { studentId, date: range(weekStart, weekEnd) }, select: { date: true, minutes: true } }),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateString(weekStart, i);
    return { date, label: WEEKDAY_NAMES[i].slice(0, 3), solved: logs.filter((l) => dbDateToString(l.date) === date).reduce((t, l) => t + l.solved, 0) };
  });
  const solved = logs.reduce((t, l) => t + l.solved, 0);
  const correct = logs.reduce((t, l) => t + l.correct, 0);
  const wrong = logs.reduce((t, l) => t + l.wrong, 0);
  const bySubject = new Map<string, { solved: number; correct: number; wrong: number }>();
  for (const l of logs) {
    const s = bySubject.get(l.subject) ?? { solved: 0, correct: 0, wrong: 0 };
    s.solved += l.solved;
    s.correct += l.correct;
    s.wrong += l.wrong;
    bySubject.set(l.subject, s);
  }
  const subjects = [...bySubject.entries()].map(([subject, s]) => ({ subject, ...s, accuracy: s.correct + s.wrong ? s.correct / (s.correct + s.wrong) : null })).sort((a, b) => b.solved - a.solved);
  const planBySubject = new Map<string, { done: number; total: number }>();
  for (const p of plan) {
    const s = planBySubject.get(p.subject) ?? { done: 0, total: 0 };
    s.total++;
    if (p.doneAt) s.done++;
    planBySubject.set(p.subject, s);
  }

  // Deneme: bu haftaki (yoksa en son) deneme ve aynı türden bir öncekine göre değişim
  const latest = results[0] ?? null;
  const previous = latest ? results.find((r, i) => i > 0 && r.exam.kind === latest.exam.kind) ?? null : null;
  const exam = latest
    ? {
        name: latest.exam.name,
        kindLabel: EXAM_PRESETS[latest.exam.kind as ExamKindName].label,
        date: dbDateToString(latest.exam.date),
        inWeek: dbDateToString(latest.exam.date) >= weekStart,
        net: latest.net,
        change: previous ? round2(latest.net - previous.net) : null,
        sections: latest.sections.sort((a, b) => a.section.order - b.section.order).map((s) => ({ name: s.section.name, net: s.net, questionCount: s.section.questionCount })),
      }
    : null;

  return {
    student,
    weekStart,
    weekEnd: addDaysToDateString(weekStart, 6),
    days,
    solved,
    previousSolved: prevLogs._sum.solved ?? 0,
    accuracy: correct + wrong ? correct / (correct + wrong) : null,
    // Soru ya da çalışma süresi girilen gün
    activeDays: days.filter((d) => d.solved > 0 || study.some((x) => dbDateToString(x.date) === d.date)).length,
    studyMinutes: study.reduce((t, x) => t + x.minutes, 0),
    subjects,
    plan: { done: plan.filter((p) => p.doneAt).length, total: plan.length, bySubject: [...planBySubject.entries()].map(([subject, s]) => ({ subject, ...s })) },
    sessions: sessions.map((s) => ({ date: dbDateToString(s.date), held: s.held, notes: s.visibleToParent ? s.notes : null, nextGoal: s.nextGoal, priorityTopics: s.priorityTopics })),
    exam,
    // Son denemenin türündeki hedef (yoksa ilk hedef)
    goal: (latest ? goals.find((g) => g.kind === latest.exam.kind) : null) ?? goals[0] ?? null,
    meeting: student.coachWeekday ? `her ${WEEKDAY_NAMES[student.coachWeekday - 1]}${student.coachMinute !== null ? ` ${minutesToTime(student.coachMinute)}` : ""}` : null,
  };
}

export type WeeklyReportData = Awaited<ReturnType<typeof weeklyReportData>>;

export async function getReport(studentId: string, weekStart: string) {
  return db.centerWeeklyReport.findUnique({ where: { studentId_weekStart: { studentId, weekStart: dateStringToDbDate(weekStart) } } });
}

/** Koçun notunu kaydeder; rapor yoksa paylaşım bağlantısıyla oluşturur. */
/** Rapor işlemleri için yeterli kurum bilgisi (zamanlayıcı da çağırır) */
type ReportCenter = { center: { id: string; name: string } };

export async function saveReport(ctx: ReportCenter, studentId: string, weekStart: string, note: string | null) {
  await kocStudentOrThrow(ctx, studentId);
  const expiresAt = new Date(Date.now() + REPORT_LINK_DAYS * 86_400_000);
  return db.centerWeeklyReport.upsert({
    where: { studentId_weekStart: { studentId, weekStart: dateStringToDbDate(weekStart) } },
    create: { centerId: ctx.center.id, studentId, weekStart: dateStringToDbDate(weekStart), note, token: randomToken(24), expiresAt },
    update: { note, expiresAt },
  });
}

/** Raporu (kayıtlı notuyla) velilere gönderir: bildirim kanalına göre e-posta / WhatsApp; mesaj geçmişine yazılır. */
export async function sendReport(ctx: ReportCenter, studentId: string, weekStart: string) {
  const existing = await getReport(studentId, weekStart);
  const report = await saveReport(ctx, studentId, weekStart, existing?.note ?? null);
  const student = await kocStudentOrThrow(ctx, studentId);
  const parents = await db.centerGuardian.findMany({ where: { studentId, isStudentAccount: false }, select: { id: true, email: true, phone: true, userId: true } });
  // Bildirim kanalı şimdilik e-posta: e-postası (ya da bağlı hesabı) olmayan veliye otomatik gönderim yapılamaz
  if (!parents.some((p) => p.email || p.userId)) throw new CenterError("Velinin e-posta adresi kayıtlı değil. “WhatsApp'ta paylaş” ile ya da bağlantıyı kopyalayıp gönderin; veli e-postasını Bilgiler sekmesinden ekleyebilirsiniz.");
  const path = `/rapor/${report.token}`;
  const range = `${weekStart.split("-").reverse().join(".")} haftası`;
  const counts = await messageGuardians({
    centerId: ctx.center.id,
    centerName: ctx.center.name,
    studentId,
    kind: "report",
    guardianIds: parents.map((p) => p.id),
    force: true,
    message: `${student.firstName} için ${range} koçluk raporu hazır.`,
    messageTitle: "Haftalık koçluk raporu",
    link: path,
    email: {
      subject: `${student.firstName} · haftalık koçluk raporu`,
      title: `${student.firstName} ${student.lastName} · ${range}`,
      lines: [`${student.firstName} için bu haftanın koçluk raporu hazır: çözdüğü sorular, programa uyumu, deneme sonucu ve koçun değerlendirmesi.`, `Bağlantı ${REPORT_LINK_DAYS} gün açıktır.`],
      action: { label: "Raporu aç", url: path },
    },
  });
  await db.centerWeeklyReport.update({ where: { id: report.id }, data: { sentAt: new Date() } });
  return { counts, token: report.token };
}

/**
 * Otomatik haftalık veli raporu (ücretli Pi Koç, ayar açık): pazar 18:00'den sonra haftada bir kez, o haftada
 * kaydı olan ve velisine e-postayla ulaşılabilen her aktif öğrencinin raporu koçun yazdığı notla gönderilir.
 */
export async function sendCoachAutoReports(now = new Date()): Promise<number> {
  const today = toLocalDateString(now);
  if (isoWeekday(today) !== 7 || toLocalMinutes(now) < 18 * 60) return 0;
  const weekStart = weekStartOf(today);
  const week = dateStringToDbDate(weekStart);
  const centers = await db.center.findMany({
    where: { kind: "COACH", status: { not: "SUSPENDED" }, coachAutoReport: true, OR: [{ coachAutoReportWeek: null }, { coachAutoReportWeek: { lt: week } }] },
    select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true },
    take: 100,
  });
  let sent = 0;
  for (const center of centers) {
    // Önce işaretle: hata olsa da aynı hafta ikinci kez gitmez
    await db.center.update({ where: { id: center.id }, data: { coachAutoReportWeek: week } });
    if (!coachPlan(center, 0, now).paid) continue;
    const students = await db.centerStudent.findMany({
      where: {
        centerId: center.id,
        status: "ACTIVE",
        guardians: { some: { isStudentAccount: false, OR: [{ email: { not: null } }, { userId: { not: null } }] } },
        weeklyReports: { none: { weekStart: week, sentAt: { not: null } } },
      },
      select: { id: true },
    });
    for (const s of students) {
      const data = await weeklyReportData(center.id, s.id, weekStart);
      // Boş hafta raporu gönderilmez
      if (!data.solved && !data.plan.total && !data.studyMinutes && !data.exam?.inWeek) continue;
      try {
        await sendReport({ center }, s.id, weekStart);
        sent++;
      } catch (error) {
        if (!(error instanceof CenterError)) throw error;
      }
    }
  }
  return sent;
}

/** Herkese açık rapor sayfası: süresi dolmamış, kurumu askıda olmayan Pi Koç raporu. */
export async function reportByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) return null;
  const report = await db.centerWeeklyReport.findUnique({ where: { token }, include: { center: { select: { kind: true, status: true, name: true, trialEndsAt: true, paidUntil: true, studentLimit: true, promoUntil: true, promoStudents: true } } } });
  if (!report || report.expiresAt < new Date() || report.center.status === "SUSPENDED" || report.center.kind !== "COACH") return null;
  return report;
}

/** Koç başına günlük yapay zekâ taslağı sınırı (ücretsiz modellerin kotasını korur) */
const AI_DRAFTS_PER_DAY = 40;

const AI_SYSTEM = [
  "Sen bir eğitim koçusun ve veliye haftalık değerlendirme yazıyorsun.",
  "Türkçe yaz, veliye 'siz' diye hitap et. En fazla 4 kısa cümle (toplam 90 kelimeyi geçme), sıcak ama abartısız, somut.",
  "Yalnızca verilen sayılara dayan; sayı, konu ya da olay uydurma, neden-sonuç tahmini yürütme. Önce iyi giden bir şeyi, sonra zayıf noktayı nazikçe söyle ve gelecek hafta için tek bir somut odak öner.",
  "Sayıları doğal yaz (ör. '5 net düştü', '-5' değil).",
  "Öğrencinin adını kullanma; gerekirse 'öğrencimiz' de. Başlık, madde işareti, emoji, selamlama ve imza kullanma.",
].join(" ");

/** Değerlendirme taslağı: yapay zekâ varsa onunla, yoksa (ya da yanıt gelmezse) kurallı özetle. Kaydetmez. */
export type ReportDraft = { text: string; source: "ai" | "rule"; notice?: string };

/** Ücretsiz pakette bu ay kalan yapay zekâ taslağı hakkı (ücretli pakette ve kurumda null: kota günlük sınırdır). */
export async function freeAiLeft(ctx: CenterContext, now = new Date()): Promise<number | null> {
  if (!ctx.coach || ctx.coach.paid) return null;
  const { piKocFreeAiPerMonth } = await loadSettings();
  const used = await countRecentAttempts(`ai-free:${ctx.center.id}`, now.getTime() - monthStartOf(now).getTime());
  return Math.max(0, piKocFreeAiPerMonth - used);
}

export async function draftReportNote(ctx: CenterContext, studentId: string, weekStart: string): Promise<ReportDraft> {
  await kocStudentOrThrow(ctx, studentId);
  const data = await weeklyReportData(ctx.center.id, studentId, weekStart);
  const input = { ...data, priorityTopics: [...new Set(data.sessions.flatMap((s) => s.priorityTopics))] };
  const rule = ruleBasedSummary(input);
  if (!aiConfigured() || (data.solved === 0 && !data.plan.total && !data.studyMinutes && !data.exam)) return { text: rule, source: "rule" };

  // Ücretsiz paket: ayda sınırlı hak; hak yalnızca yapay zekâ metni döndürünce düşer
  const freeLeft = await freeAiLeft(ctx);
  if (freeLeft === 0) return { text: rule, source: "rule", notice: "Ücretsiz paketteki bu ayki yapay zekâ hakkınız kullanıldı; verilerden özet yazıldı. Ücretli pakette yapay zekâ her hafta kullanılabilir." };

  const limitKey = `ai-draft:${ctx.center.id}`;
  if ((await countRecentAttempts(limitKey, 86_400_000)) >= AI_DRAFTS_PER_DAY) return { text: rule, source: "rule" };
  await recordLoginAttempt(limitKey, null, false);

  const text = await aiText({ system: AI_SYSTEM, prompt: summaryFacts(input, data.student.gradeName) });
  // Model yanlışlıkla düşünme ya da madde işareti döndürürse sade metne indir
  const clean = text?.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^[-*•]\s+/gm, "").replace(/\n{2,}/g, "\n\n").trim().slice(0, 3000);
  if (!clean) return { text: rule, source: "rule" };
  if (freeLeft !== null) await recordLoginAttempt(`ai-free:${ctx.center.id}`, null, false);
  return { text: clean, source: "ai", ...(freeLeft === 1 ? { notice: "Ücretsiz paketteki bu ayki yapay zekâ hakkınızı kullandınız." } : {}) };
}

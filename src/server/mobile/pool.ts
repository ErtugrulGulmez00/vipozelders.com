import type { CreditPurchase, PoolQuestion } from "@/generated/prisma/client";
import { CREDIT_ENTRY_KIND, CREDIT_PURCHASE_STATUS, POOL_STATUS } from "@/lib/labels";
import { creditLots, parsePackages, refundPreview, singleQuestionPrice } from "../credits";
import { db } from "../db";
import { salesOpen } from "../payments/service";
import { poolSubjects, teacherPoolFeed, teacherQuestion } from "../question-pool";
import { loadSettings } from "../settings";
import { notFound } from "./http";
import { absoluteUpload } from "./serialize";

// Soru kredisi ve soru havuzunun mobil biçimleri. İş kuralları src/server/credits.ts ve question-pool.ts'te.

const MAX_ACTIVE_CLAIMS = 3;

function statusOf(status: string) {
  return { status, statusLabel: POOL_STATUS[status]?.label ?? status };
}

/** Kredi paketleri, bakiye, satın almalar ve hareketler (Kredilerim + Soru sor ekranı). */
export async function creditsJson(studentId: string, now = new Date()) {
  const settings = await loadSettings();
  const packages = parsePackages(settings.questionPackages);
  const single = singleQuestionPrice(packages);
  const [lots, entries, purchases, subjects] = await Promise.all([
    creditLots(studentId, undefined, now),
    db.creditLedger.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.creditPurchase.findMany({ where: { studentId, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, orderBy: { createdAt: "desc" }, take: 30 }),
    poolSubjects(),
  ]);
  const remaining = new Map(lots.map((l) => [l.id, l.remaining]));
  const balance = lots.filter((l) => !l.expired).reduce((sum, l) => sum + Math.max(0, l.remaining), 0);
  return {
    balance,
    salesOpen: salesOpen(),
    rules: {
      validityMonths: settings.creditValidityMonths,
      refundDays: settings.creditRefundDays,
      answerHours: settings.questionAnswerHours,
      disputeHours: settings.disputeWindowHours,
      singlePrice: single,
    },
    packages: packages.map((p) => {
      const unit = Math.round(p.price / p.credits);
      return { credits: p.credits, price: p.price, unitPrice: unit, savingPercent: single > 0 ? Math.max(0, Math.round((1 - unit / single) * 100)) : 0 };
    }),
    // Soru gönderilebilecek kademe/ders çiftleri (havuzda uygun öğretmeni olanlar)
    subjects: subjects.map((s) => {
      const [levelId, subjectId] = s.value.split(":").map(Number);
      return { levelId, subjectId, levelName: s.levelName, subjectName: s.subjectName };
    }),
    purchases: await Promise.all(
      purchases.map(async (p) => {
        const expired = Boolean(p.expiresAt && p.expiresAt <= now);
        const preview = await refundPreview(p, settings, now);
        return {
          ...purchaseJson(p),
          remaining: Math.max(0, remaining.get(p.id) ?? 0),
          expired,
          refund: preview.allowed ? { allowed: true, amount: preview.amount, reason: null } : { allowed: false, amount: 0, reason: preview.reason },
        };
      }),
    ),
    entries: entries.map((e) => ({ id: e.id, kind: e.kind, kindLabel: CREDIT_ENTRY_KIND[e.kind] ?? e.kind, amount: e.amount, note: e.note, createdAt: e.createdAt })),
  };
}

export function purchaseJson(p: CreditPurchase) {
  return {
    id: p.id,
    code: p.code,
    credits: p.credits,
    price: p.price,
    refundedAmount: p.refundedAmount,
    status: p.status,
    statusLabel: CREDIT_PURCHASE_STATUS[p.status]?.label ?? p.status,
    paidAt: p.paidAt,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  };
}

/** Ödeme sonrası sorgulanan satın alma durumu (son ödeme denemesinin hatasıyla). */
export async function purchaseStatusJson(studentId: string, id: string) {
  const purchase = await db.creditPurchase.findUnique({ where: { id }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!purchase || purchase.studentId !== studentId) throw notFound("Satın alma bulunamadı.");
  const last = purchase.payments[0];
  return { ...purchaseJson(purchase), payment: last ? { status: last.status, failureReason: last.failureReason } : null };
}

/** Öğrencinin soru kartı (liste). */
function questionSummary(q: PoolQuestion) {
  return {
    id: q.id,
    code: q.code,
    levelName: q.levelName,
    subjectName: q.subjectName,
    note: q.note,
    imageUrl: absoluteUpload(q.imageKey),
    ...statusOf(q.status),
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
    answeredAt: q.answeredAt,
  };
}

export async function studentQuestionsJson(studentId: string, page: number) {
  const size = 20;
  const rows = await db.poolQuestion.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * size, take: size + 1 });
  return { items: rows.slice(0, size).map(questionSummary), nextPage: rows.length > size ? page + 1 : null };
}

function answerJson(q: PoolQuestion) {
  if (!q.answeredAt) return null;
  return {
    text: q.answerText,
    imageUrl: absoluteUpload(q.answerImageKey),
    videoUrl: absoluteUpload(q.answerVideoKey),
    answeredAt: q.answeredAt,
    followUp: q.followUpText ? { text: q.followUpText, askedAt: q.followUpAt, answer: q.followUpAnswer, answeredAt: q.followUpAnsweredAt } : null,
  };
}

/** Öğrencinin soru ayrıntısı; düğmeler actions alanına göre gösterilir. */
export async function studentQuestionJson(studentId: string, id: string, now = new Date()) {
  const q = await db.poolQuestion.findUnique({ where: { id }, include: { claimedBy: { select: { user: { select: { firstName: true, lastName: true } }, photoKey: true } } } });
  if (!q || q.studentId !== studentId) throw notFound("Soru bulunamadı.");
  const disputeOpen = q.status === "ANSWERED" && Boolean(q.disputeUntil && q.disputeUntil > now);
  return {
    ...questionSummary(q),
    teacher: q.claimedBy && q.answeredAt ? { name: `${q.claimedBy.user.firstName} ${q.claimedBy.user.lastName.charAt(0)}.`, photoUrl: absoluteUpload(q.claimedBy.photoKey) } : null,
    answer: answerJson(q),
    rating: q.rating,
    rejectReason: q.rejectReason,
    disputeReason: q.disputeReason,
    resolutionNote: q.resolutionNote,
    disputeUntil: q.disputeUntil,
    actions: {
      canCancel: q.status === "OPEN",
      canFollowUp: disputeOpen && !q.followUpText,
      canRate: ["ANSWERED", "CLOSED"].includes(q.status),
      canDispute: disputeOpen,
    },
  };
}

// ---------------------------------------------------------------------------
// Öğretmen
// ---------------------------------------------------------------------------

/** Öğretmenin gördüğü soru: öğrencinin adı gösterilmez. */
function teacherQuestionSummary(q: PoolQuestion, teacherId: string) {
  return {
    id: q.id,
    code: q.code,
    levelName: q.levelName,
    subjectName: q.subjectName,
    note: q.note,
    imageUrl: absoluteUpload(q.imageKey),
    ...statusOf(q.status),
    mine: q.claimedById === teacherId,
    fee: q.teacherFee,
    createdAt: q.createdAt,
    expiresAt: q.expiresAt,
    claimExpiresAt: q.claimedById === teacherId ? q.claimExpiresAt : null,
    answeredAt: q.answeredAt,
  };
}

export async function teacherPoolJson(teacherId: string, now = new Date()) {
  const [feed, profile, settings] = await Promise.all([
    teacherPoolFeed(teacherId, now),
    db.teacherProfile.findUnique({ where: { userId: teacherId }, select: { answersPool: true } }),
    loadSettings(),
  ]);
  return {
    answersPool: profile?.answersPool ?? false,
    eligible: feed.eligible,
    blocked: feed.standing.blocked,
    standing: { ratingAvg: feed.standing.avg, ratingCount: feed.standing.ratings, upheldDisputes: feed.standing.upheldDisputes },
    rules: { claimMinutes: settings.poolClaimMinutes, maxActiveClaims: MAX_ACTIVE_CLAIMS, fee: settings.poolTeacherFeeTl * 100 },
    open: feed.open.map((q) => teacherQuestionSummary(q, teacherId)),
    mine: feed.mine.map((q) => teacherQuestionSummary(q, teacherId)),
  };
}

export async function teacherQuestionJson(teacherId: string, id: string, now = new Date()) {
  const q = await teacherQuestion(teacherId, id);
  const mine = q.claimedById === teacherId;
  const claimed = mine && q.status === "CLAIMED";
  return {
    ...teacherQuestionSummary(q, teacherId),
    answer: mine ? answerJson(q) : null,
    rating: mine ? q.rating : null,
    disputeReason: mine ? q.disputeReason : null,
    resolutionNote: mine ? q.resolutionNote : null,
    releaseAt: mine ? q.releaseAt : null,
    actions: {
      canClaim: q.status === "OPEN" && q.expiresAt > now,
      canRelease: claimed,
      canReject: claimed,
      canAnswer: claimed,
      canAnswerFollowUp: mine && Boolean(q.followUpText) && !q.followUpAnswer,
    },
  };
}

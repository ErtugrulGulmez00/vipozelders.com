import type { Prisma, QuestionSubscription } from "@/generated/prisma/client";
import { formatDate, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { maskContacts } from "@/lib/text";
import { newCode } from "./credits";
import { db, type DbTransaction } from "./db";
import { appUrl } from "./email";
import { addLedgerEntry } from "./ledger";
import { notify } from "./notifications";
import { getPaymentProvider, getProviderById, PAYMENT_PROVIDERS, processRefund, salesOpen } from "./payments/service";
import { settledReleaseAt, splitCommission } from "./pricing";
import { loadSettings, type SiteSettings } from "./settings";
import { deleteUpload, saveUpload, UploadError } from "./storage";

// Aylık soru aboneliği: öğretmen kademe + ders için plan açar (dönem ücreti, günlük soru sınırı, cevap süresi).
// Veli dönemi peşin öder; sorular soru havuzu kaydı olarak doğrudan öğretmene düşer (CLAIMED, ücret 0).
// Öğretmen payı ödemede bekleyen hakedişe yazılır, dönem bitip itiraz ve aktarım süresi dolunca serbest kalır.
// Süresinde cevaplanmayan soru sınırı aşılırsa abonelik erken biter, kalan günlerin parası iade edilir.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IMAGE_MAX = 8 * 1024 * 1024;

export class SubscriptionError extends Error {}

type Tx = DbTransaction | typeof db;

const hasFile = (file: File | null | undefined): file is File => Boolean(file && file.size > 0);

/** Abonelik şu an soru kabul ediyor mu? (Yenilemede sıradaki dönem henüz başlamamış olabilir.) */
export function isRunning(sub: Pick<QuestionSubscription, "status" | "startsAt" | "endsAt">, now = new Date()): boolean {
  return sub.status === "ACTIVE" && Boolean(sub.startsAt && sub.endsAt && sub.startsAt <= now && sub.endsAt > now);
}

/** Erken bitişte bölüşüm: geçen süre öğretmene, kalan süre veliye. */
export function proRataSplit(sub: Pick<QuestionSubscription, "price" | "teacherAmount" | "refundedAmount" | "startsAt" | "endsAt">, now: Date) {
  const start = sub.startsAt?.getTime() ?? now.getTime();
  const end = sub.endsAt?.getTime() ?? now.getTime();
  const total = Math.max(1, end - start);
  const used = Math.min(total, Math.max(0, now.getTime() - start));
  const refund = Math.max(0, Math.min(sub.price - sub.refundedAmount, Math.round((sub.price * (total - used)) / total)));
  const teacherEarned = Math.round((sub.teacherAmount * used) / total);
  return { refund, teacherEarned };
}

// ---------------------------------------------------------------------------
// Öğretmen: planlar
// ---------------------------------------------------------------------------

/** Öğretmenin plan açabileceği kademe + ders çiftleri (aktif dersleri). */
export async function teacherPlanPairs(teacherId: string) {
  const offerings = await db.teacherOffering.findMany({
    where: { teacherId, isActive: true },
    distinct: ["levelId", "subjectId"],
    select: { levelId: true, subjectId: true, level: { select: { name: true, sortOrder: true } }, subject: { select: { name: true, sortOrder: true } } },
  });
  return offerings
    .sort((a, b) => a.level.sortOrder - b.level.sortOrder || a.subject.sortOrder - b.subject.sortOrder)
    .map((o) => ({ levelId: o.levelId, subjectId: o.subjectId, label: `${o.level.name} · ${o.subject.name}` }));
}

export type PlanInput = { levelId: number; subjectId: number; priceTl: number; dailyLimit: number; answerHours: number; description: string | null; isActive: boolean };

export async function saveQuestionPlan(teacherId: string, input: PlanInput) {
  const settings = await loadSettings();
  if (!settings.subscriptionsEnabled) throw new SubscriptionError("Soru aboneliği şu an kapalı.");
  const pairs = await teacherPlanPairs(teacherId);
  if (!pairs.some((p) => p.levelId === input.levelId && p.subjectId === input.subjectId)) throw new SubscriptionError("Bu kademe ve ders, verdiğiniz dersler arasında yok. Önce Dersler ve fiyatlar sayfasından ekleyin.");
  if (!Number.isInteger(input.priceTl) || input.priceTl < settings.subscriptionMinPriceTl || input.priceTl > settings.subscriptionMaxPriceTl) {
    throw new SubscriptionError(`Ücret ${formatMoney(settings.subscriptionMinPriceTl * 100)} ile ${formatMoney(settings.subscriptionMaxPriceTl * 100)} arasında olmalı.`);
  }
  if (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 50) throw new SubscriptionError("Günlük soru sınırı 1 ile 50 arasında olmalı.");
  if (!Number.isInteger(input.answerHours) || input.answerHours < 1 || input.answerHours > 48) throw new SubscriptionError("Cevap süresi 1 ile 48 saat arasında olmalı.");
  const data = {
    price: input.priceTl * 100,
    dailyLimit: input.dailyLimit,
    answerHours: input.answerHours,
    description: input.description ? maskContacts(input.description.trim()).slice(0, 500) || null : null,
    isActive: input.isActive,
  };
  return db.questionPlan.upsert({
    where: { teacherId_levelId_subjectId: { teacherId, levelId: input.levelId, subjectId: input.subjectId } },
    create: { teacherId, levelId: input.levelId, subjectId: input.subjectId, ...data },
    update: data,
  });
}

/** Profilde gösterilen planlar (yalnızca yayındaki öğretmen, aktif plan). */
export async function publicPlans(teacherId: string) {
  const settings = await loadSettings();
  if (!settings.subscriptionsEnabled) return [];
  return db.questionPlan.findMany({
    where: { teacherId, isActive: true, teacher: { status: "PUBLISHED", user: { status: "ACTIVE" } } },
    include: { level: { select: { name: true, sortOrder: true } }, subject: { select: { name: true } } },
    orderBy: [{ level: { sortOrder: "asc" } }, { price: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Veli: satın alma ve ödeme
// ---------------------------------------------------------------------------

export async function createSubscription(studentId: string, planId: string) {
  if (!salesOpen()) throw new SubscriptionError("Online ödeme altyapımız çok yakında açılıyor; şu an abonelik satışı yapılamıyor.");
  const settings = await loadSettings();
  if (!settings.subscriptionsEnabled) throw new SubscriptionError("Soru aboneliği şu an kapalı.");
  const plan = await db.questionPlan.findUnique({ where: { id: planId }, include: { level: true, subject: true, teacher: { include: { user: true } } } });
  if (!plan || !plan.isActive || plan.teacher.status !== "PUBLISHED" || plan.teacher.user.status !== "ACTIVE") throw new SubscriptionError("Bu abonelik şu an satışta değil.");
  if (plan.teacherId === studentId) throw new SubscriptionError("Kendinize abone olamazsınız.");
  const student = await db.user.findUnique({ where: { id: studentId }, select: { role: true, email: true } });
  if (student?.role !== "STUDENT") throw new SubscriptionError("Abonelik yalnızca veli/öğrenci hesabıyla alınabilir.");
  if (!student.email) throw new SubscriptionError("Ödeme için hesabınızda e-posta adresi olmalı.");
  if (getPaymentProvider().requiresSubMerchant && !plan.teacher.subMerchantKey) throw new SubscriptionError("Öğretmenin ödeme hesabı henüz tamamlanmadığı için şu an abone olunamıyor.");
  const { commissionAmount, teacherAmount } = splitCommission(plan.price, settings.subscriptionCommissionBps);
  return db.questionSubscription.create({
    data: {
      code: newCode("AB"),
      planId: plan.id,
      studentId,
      teacherId: plan.teacherId,
      levelId: plan.levelId,
      subjectId: plan.subjectId,
      levelName: plan.level.name,
      subjectName: plan.subject.name,
      price: plan.price,
      commissionRateBps: settings.subscriptionCommissionBps,
      commissionAmount,
      teacherAmount,
      dailyLimit: plan.dailyLimit,
      answerHours: plan.answerHours,
      days: settings.subscriptionDays,
    },
  });
}

export async function startSubscriptionCheckout(subscriptionId: string, studentId: string, ipAddress: string): Promise<string> {
  const sub = await db.questionSubscription.findUnique({
    where: { id: subscriptionId },
    include: { student: { include: { studentProfile: { include: { city: true } } } }, teacher: { select: { subMerchantKey: true, user: { select: { firstName: true, lastName: true } } } } },
  });
  if (!sub || sub.studentId !== studentId) throw new SubscriptionError("Abonelik bulunamadı.");
  if (sub.status !== "PENDING_PAYMENT") throw new SubscriptionError("Bu abonelik için ödeme beklenmiyor.");
  const provider = getPaymentProvider();
  const payment = await db.payment.create({ data: { subscriptionId: sub.id, provider: provider.id, amount: sub.price } });
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: sub.id,
      bookingCode: sub.code,
      amount: sub.price,
      description: `${sub.levelName} ${sub.subjectName} soru aboneliği (${sub.days} gün) · ${sub.teacher.user.firstName} ${sub.teacher.user.lastName}`,
      buyer: {
        id: sub.studentId,
        firstName: sub.student.firstName,
        lastName: sub.student.lastName,
        email: sub.student.email!,
        phone: sub.student.phone,
        ipAddress,
        city: sub.student.studentProfile?.city?.name ?? null,
        registeredAt: sub.student.createdAt,
      },
      teacher: { subMerchantKey: sub.teacher.subMerchantKey, amount: sub.teacherAmount },
      callbackUrl: appUrl(`/api/odeme/${provider.id}/donus`),
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerToken: session.token } });
    return session.redirectUrl;
  } catch (error) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: String(error).slice(0, 300) } });
    throw new SubscriptionError("Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar deneyin.");
  }
}

/**
 * Ödeme kuruluşundan dönüşte aboneliği başlatır (tekrar çağrılabilir). Aynı öğretmen ve derste süren dönem
 * varsa yeni dönem onun bitişinden başlar (yenileme).
 */
export async function completeSubscriptionCheckout(
  payment: { id: string; provider: string; status: string; subscriptionId: string | null; providerToken: string | null },
  now = new Date(),
): Promise<"paid" | "failed" | "already" | "pending"> {
  if (!payment.subscriptionId || !payment.providerToken) return "failed";
  if (payment.status !== "INITIATED") return "already";
  const result = await getProviderById(payment.provider).retrieveResult(payment.providerToken);
  if (result.status === "pending") return "pending";
  const raw = (result.raw ?? undefined) as Prisma.InputJsonValue | undefined;
  if (result.status === "failure") {
    await db.payment.updateMany({ where: { id: payment.id, status: "INITIATED" }, data: { status: "FAILED", failureReason: result.reason.slice(0, 300), raw } });
    await db.questionSubscription.updateMany({ where: { id: payment.subscriptionId, status: "PENDING_PAYMENT" }, data: { status: "FAILED" } });
    return "failed";
  }
  return db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: "INITIATED" },
      data: { status: "SUCCEEDED", providerPaymentId: result.providerPaymentId, providerItemId: result.providerItemId, raw },
    });
    if (updated.count === 0) return "already";
    const sub = await tx.questionSubscription.findUniqueOrThrow({ where: { id: payment.subscriptionId! } });
    if (result.paidAmount !== sub.price) throw new SubscriptionError("Ödenen tutar abonelik ücretiyle uyuşmuyor.");
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`subs:${sub.studentId}:${sub.teacherId}`}))`;
    const previous = await tx.questionSubscription.findFirst({
      where: { studentId: sub.studentId, teacherId: sub.teacherId, levelId: sub.levelId, subjectId: sub.subjectId, status: "ACTIVE", endsAt: { gt: now } },
      orderBy: { endsAt: "desc" },
    });
    const startsAt = previous?.endsAt ?? now;
    const endsAt = new Date(startsAt.getTime() + sub.days * DAY);
    await tx.questionSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", paidAt: now, startsAt, endsAt } });
    await addLedgerEntry(tx, { teacherId: sub.teacherId, subscriptionId: sub.id, bucket: "PENDING", amount: sub.teacherAmount, description: `${sub.code} soru aboneliği (dönem bitince serbest kalır)` });
    const renewal = Boolean(previous);
    await notify(
      {
        userId: sub.studentId,
        type: "subscription.started",
        title: renewal ? "Aboneliğiniz yenilendi" : "Soru aboneliğiniz başladı",
        body: renewal
          ? `${sub.levelName} ${sub.subjectName} aboneliğiniz ${formatDate(startsAt)} tarihinden ${formatDate(endsAt)} tarihine kadar uzatıldı.`
          : `${sub.levelName} ${sub.subjectName}: ${formatDate(endsAt)} tarihine kadar günde ${sub.dailyLimit} soruya kadar gönderebilirsiniz.`,
        link: `/hesabim/abonelikler/${sub.id}`,
      },
      tx,
    );
    await notify(
      {
        userId: sub.teacherId,
        type: "subscription.new",
        title: renewal ? "Aboneliğiniz yenilendi" : "Yeni soru abonesi",
        body: `${sub.levelName} ${sub.subjectName} · ${formatMoney(sub.teacherAmount)} hakedişiniz dönem sonunda serbest kalır. Sorular Soru havuzu sayfanıza düşer; her soruyu ${sub.answerHours} saat içinde cevaplayın.`,
        link: "/ogretmen-paneli/soru-aboneligi",
        email: false,
      },
      tx,
    );
    return "paid";
  });
}

// ---------------------------------------------------------------------------
// Veli: soru gönderme
// ---------------------------------------------------------------------------

function localDayStart(now: Date) {
  return zonedDateTime(toLocalDateString(now), 0);
}

/** Bugün sorulan (geri çevrilmeyen) soru sayısı. */
export async function questionsToday(subscriptionId: string, now = new Date(), tx: Tx = db) {
  return tx.poolQuestion.count({ where: { subscriptionId, createdAt: { gte: localDayStart(now) }, status: { notIn: ["CANCELLED", "REJECTED", "EXPIRED"] } } });
}

export async function askSubscriptionQuestion(studentId: string, subscriptionId: string, input: { note: string | null; image: File | null }, now = new Date()) {
  const sub = await db.questionSubscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || sub.studentId !== studentId) throw new SubscriptionError("Abonelik bulunamadı.");
  if (!isRunning(sub, now)) throw new SubscriptionError(sub.status === "ACTIVE" && sub.startsAt && sub.startsAt > now ? `Bu dönem ${formatDate(sub.startsAt)} tarihinde başlıyor.` : "Bu abonelik aktif değil.");
  if (!hasFile(input.image)) throw new SubscriptionError("Sorunun fotoğrafını ekleyin.");
  if ((await questionsToday(sub.id, now)) >= sub.dailyLimit) throw new SubscriptionError(`Bugünkü ${sub.dailyLimit} soru hakkınızı kullandınız; yarın yeniden gönderebilirsiniz.`);
  let imageKey: string;
  try {
    imageKey = await saveUpload(input.image, { visibility: "private", folder: "soru-havuzu", maxBytes: IMAGE_MAX, kinds: ["image"] });
  } catch (error) {
    if (error instanceof UploadError) throw new SubscriptionError(error.message);
    throw error;
  }
  const expiresAt = new Date(now.getTime() + sub.answerHours * HOUR);
  try {
    const question = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`subq:${sub.id}`}))`;
      if ((await questionsToday(sub.id, now, tx)) >= sub.dailyLimit) throw new SubscriptionError(`Bugünkü ${sub.dailyLimit} soru hakkınızı kullandınız; yarın yeniden gönderebilirsiniz.`);
      return tx.poolQuestion.create({
        data: {
          code: newCode("SA"),
          studentId,
          subscriptionId: sub.id,
          levelId: sub.levelId,
          subjectId: sub.subjectId,
          levelName: sub.levelName,
          subjectName: sub.subjectName,
          note: input.note ? maskContacts(input.note.trim()).slice(0, 1000) : null,
          imageKey,
          // Soru doğrudan abone olunan öğretmendedir; havuza düşmez (kilit süresi = cevap süresi).
          status: "CLAIMED",
          claimedById: sub.teacherId,
          claimedAt: now,
          claimExpiresAt: expiresAt,
          expiresAt,
          teacherFee: 0,
          // Günlük sınır bu saate göre sayılır
          createdAt: now,
        },
      });
    });
    await notify({ userId: sub.teacherId, type: "subscription.question", title: `Abonenizden yeni soru: ${sub.levelName} ${sub.subjectName}`, body: `${question.code} · ${sub.answerHours} saat içinde cevaplayın.`, link: `/ogretmen-paneli/soru-havuzu/${question.id}` });
    return question;
  } catch (error) {
    await deleteUpload(imageKey);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// İade ve erken bitiş
// ---------------------------------------------------------------------------

/** Veli iadesi: ödemeden sonraki ilk günlerde ve hiç soru sorulmadıysa tam iade. */
export async function refundPreviewFor(sub: QuestionSubscription, settings: SiteSettings, now = new Date(), tx: Tx = db) {
  if (sub.status !== "ACTIVE" || !sub.paidAt) return { allowed: false as const, reason: "Bu abonelik iade edilemez." };
  if (now.getTime() - sub.paidAt.getTime() > settings.subscriptionRefundDays * DAY) return { allowed: false as const, reason: `İade süresi (ödemeden sonraki ${settings.subscriptionRefundDays} gün) doldu.` };
  const asked = await tx.poolQuestion.count({ where: { subscriptionId: sub.id } });
  if (asked) return { allowed: false as const, reason: "Bu dönemde soru gönderdiğiniz için iade yapılamaz." };
  return { allowed: true as const, amount: sub.price - sub.refundedAmount };
}

async function createRefund(tx: DbTransaction, subscriptionId: string, amount: number, reason: string) {
  if (amount <= 0) return null;
  const payment = await tx.payment.findFirst({ where: { subscriptionId, status: "SUCCEEDED" }, orderBy: { createdAt: "desc" } });
  if (!payment) throw new SubscriptionError("Ödeme kaydı bulunamadı.");
  return (await tx.refund.create({ data: { paymentId: payment.id, amount, reason } })).id;
}

export async function refundSubscription(subscriptionId: string, studentId: string, now = new Date()) {
  const settings = await loadSettings();
  let refundId: string | null = null;
  let amount = 0;
  await db.$transaction(async (tx) => {
    const sub = await tx.questionSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub || sub.studentId !== studentId) throw new SubscriptionError("Abonelik bulunamadı.");
    const preview = await refundPreviewFor(sub, settings, now, tx);
    if (!preview.allowed) throw new SubscriptionError(preview.reason);
    amount = preview.amount;
    const marked = await tx.questionSubscription.updateMany({
      where: { id: sub.id, status: "ACTIVE" },
      data: { status: "REFUNDED", refundedAmount: { increment: amount }, cancelledAt: now, cancelReason: "Veli iade istedi", earningsReleasedAt: now },
    });
    if (marked.count !== 1) throw new SubscriptionError("Aboneliğin durumu değişmiş. Sayfayı yenileyin.");
    await addLedgerEntry(tx, { teacherId: sub.teacherId, subscriptionId: sub.id, bucket: "PENDING", amount: -sub.teacherAmount, description: `${sub.code} abonelik iade edildi` });
    refundId = await createRefund(tx, sub.id, amount, "Soru aboneliği iadesi (soru sorulmadı)");
    await notify({ userId: sub.teacherId, type: "subscription.refunded", title: "Bir abonelik iade edildi", body: `${sub.code} · ${sub.levelName} ${sub.subjectName}. Veli soru göndermeden iade istedi; bu dönemden hakediş oluşmadı.`, link: "/ogretmen-paneli/soru-aboneligi", email: false }, tx);
  });
  if (refundId) await processRefund(refundId);
  return amount;
}

/**
 * Aboneliği hemen bitirir: başlamış dönemde kalan günlerin ücreti iade edilir, geçen günlerin payı öğretmende kalır;
 * henüz başlamamış (yenileme) dönem tamamen iade edilir. Öğretmendeki cevaplanmamış sorular kapanır.
 */
export async function endSubscriptionEarly(subscriptionId: string, reason: string, actorId: string | null, now = new Date()) {
  const settings = await loadSettings();
  const refundIds: string[] = [];
  await db.$transaction(async (tx) => {
    const sub = await tx.questionSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub || sub.status !== "ACTIVE") throw new SubscriptionError("Bu abonelik aktif değil.");
    const started = Boolean(sub.startsAt && sub.startsAt <= now);
    const { refund, teacherEarned } = started ? proRataSplit(sub, now) : { refund: sub.price - sub.refundedAmount, teacherEarned: 0 };
    const marked = await tx.questionSubscription.updateMany({
      where: { id: sub.id, status: "ACTIVE" },
      data: {
        status: started ? "CANCELLED" : "REFUNDED",
        endsAt: started ? now : sub.endsAt,
        refundedAmount: { increment: refund },
        cancelledAt: now,
        cancelReason: reason.slice(0, 300),
        earningsReleaseAt: settledReleaseAt(new Date(now.getTime() + settings.disputeWindowHours * HOUR), sub.paidAt, settings.settlementDays),
        ...(teacherEarned > 0 ? {} : { earningsReleasedAt: now }),
      },
    });
    if (marked.count !== 1) throw new SubscriptionError("Aboneliğin durumu değişmiş. Sayfayı yenileyin.");
    if (teacherEarned !== sub.teacherAmount) {
      await addLedgerEntry(tx, { teacherId: sub.teacherId, subscriptionId: sub.id, bucket: "PENDING", amount: teacherEarned - sub.teacherAmount, description: `${sub.code} abonelik erken bitti (kalan günler iade)` });
    }
    await tx.poolQuestion.updateMany({ where: { subscriptionId: sub.id, status: "CLAIMED" }, data: { status: "CANCELLED", claimExpiresAt: null } });
    const refundId = await createRefund(tx, sub.id, refund, `Soru aboneliği erken bitti: ${reason}`.slice(0, 300));
    if (refundId) refundIds.push(refundId);
    if (actorId) await tx.auditLog.create({ data: { actorId, action: "subscription.ended_early", entityType: "QuestionSubscription", entityId: sub.id, details: { reason, refund, teacherEarned } } });
    await notify({ userId: sub.studentId, type: "subscription.ended_early", title: "Aboneliğiniz sonlandırıldı", body: `${sub.levelName} ${sub.subjectName} (${sub.code}): ${reason}. ${refund > 0 ? `${formatMoney(refund)} kartınıza iade ediliyor.` : ""}`.trim(), link: `/hesabim/abonelikler/${sub.id}` }, tx);
    await notify({ userId: sub.teacherId, type: "subscription.ended_early", title: "Bir aboneliğiniz sonlandırıldı", body: `${sub.code} · ${reason}. Bu dönemden hakedişiniz: ${formatMoney(teacherEarned)}.`, link: "/ogretmen-paneli/soru-aboneligi", email: false }, tx);
  });
  for (const id of refundIds) await processRefund(id);
}

/**
 * Süresinde cevaplanmayan ya da itirazı haklı bulunan soru sayılır (transaction içinde). Sınıra ulaşıldıysa
 * true döner; çağıran transaction bittikten sonra endSubscriptionForMisses çağırır.
 */
export async function registerMiss(tx: DbTransaction, subscriptionId: string, settings: SiteSettings): Promise<boolean> {
  const sub = await tx.questionSubscription.update({ where: { id: subscriptionId }, data: { missedCount: { increment: 1 } } });
  if (sub.status !== "ACTIVE") return false;
  if (sub.missedCount < settings.subscriptionMissLimit) {
    await notify({ userId: sub.teacherId, type: "subscription.missed", title: "Abone sorusu süresinde cevaplanmadı", body: `${sub.code}: ${sub.missedCount}/${settings.subscriptionMissLimit}. Sınıra ulaşılırsa abonelik sona erer ve kalan günlerin ücreti veliye iade edilir.`, link: "/ogretmen-paneli/soru-aboneligi" }, tx);
    return false;
  }
  return true;
}

/** Cevaplanmayan soru sınırı aşıldı: bu dönem ve aynı öğretmenden sıradaki dönemler biter. */
export async function endSubscriptionForMisses(subscriptionId: string, now = new Date()) {
  const settings = await loadSettings();
  const sub = await db.questionSubscription.findUnique({ where: { id: subscriptionId } });
  if (!sub || sub.status !== "ACTIVE") return;
  const reason = `Öğretmen ${settings.subscriptionMissLimit} soruyu süresinde cevaplamadı`;
  const queued = await db.questionSubscription.findMany({ where: { studentId: sub.studentId, teacherId: sub.teacherId, status: "ACTIVE", startsAt: { gt: now } }, select: { id: true } });
  for (const id of [sub.id, ...queued.map((q) => q.id)]) {
    await endSubscriptionEarly(id, reason, null, now).catch((error: unknown) => {
      if (!(error instanceof SubscriptionError)) throw error;
    });
  }
}

// ---------------------------------------------------------------------------
// Zamanlayıcı
// ---------------------------------------------------------------------------

/** Dönemi biten abonelikler kapanır; hakediş zamanı gelenler serbest bırakılır; yenileme hatırlatması gider. */
export async function processSubscriptions(now = new Date()) {
  const settings = await loadSettings();
  let changed = 0;

  // 1) Dönem bitti
  const ended = await db.questionSubscription.findMany({ where: { status: "ACTIVE", endsAt: { lte: now } }, take: 200 });
  for (const sub of ended) {
    const releaseAt = settledReleaseAt(new Date(sub.endsAt!.getTime() + settings.disputeWindowHours * HOUR), sub.paidAt, settings.settlementDays);
    const marked = await db.questionSubscription.updateMany({ where: { id: sub.id, status: "ACTIVE" }, data: { status: "ENDED", earningsReleaseAt: releaseAt } });
    changed += marked.count;
  }

  // 2) Hakediş serbest
  const due = await db.questionSubscription.findMany({
    where: { status: { in: ["ENDED", "CANCELLED"] }, earningsReleaseAt: { lte: now }, earningsReleasedAt: null },
    include: { payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } } } },
    take: 100,
  });
  for (const sub of due) {
    const pendingRefunds = await db.refund.count({ where: { payment: { subscriptionId: sub.id }, status: "PENDING" } });
    if (pendingRefunds > 0) continue;
    const amount = (await db.ledgerEntry.aggregate({ where: { subscriptionId: sub.id, bucket: "PENDING" }, _sum: { amount: true } }))._sum.amount ?? 0;
    const payment = sub.payments[0];
    const provider = payment && payment.provider in PAYMENT_PROVIDERS ? getProviderById(payment.provider) : getPaymentProvider();
    if (amount > 0) {
      const result = await provider.releaseToTeacher({ providerItemId: payment?.providerItemId ?? null, reference: sub.code }).catch((error: unknown) => ({ ok: false as const, error: String(error) }));
      if (!result.ok) continue;
    }
    await db.$transaction(async (tx) => {
      const marked = await tx.questionSubscription.updateMany({ where: { id: sub.id, earningsReleasedAt: null }, data: { earningsReleasedAt: now } });
      if (marked.count !== 1 || amount <= 0) return;
      await addLedgerEntry(tx, { teacherId: sub.teacherId, subscriptionId: sub.id, bucket: "PENDING", amount: -amount, description: `${sub.code} hakediş serbest bırakıldı` });
      if (provider.automaticPayouts) {
        const payout = await tx.payout.create({ data: { teacherId: sub.teacherId, amount, method: "PAYMENT_PROVIDER", reference: sub.code } });
        await addLedgerEntry(tx, { teacherId: sub.teacherId, subscriptionId: sub.id, payoutId: payout.id, bucket: "PAID", amount, description: `${sub.code} ödeme kuruluşu tarafından aktarıldı` });
      } else {
        await addLedgerEntry(tx, { teacherId: sub.teacherId, subscriptionId: sub.id, bucket: "AVAILABLE", amount, description: `${sub.code} soru aboneliği` });
      }
      await notify({ userId: sub.teacherId, type: "earning.released", title: "Hakedişiniz serbest kaldı", body: `${sub.code} soru aboneliği için ${formatMoney(amount)} ödenebilir bakiyenize eklendi.`, link: "/ogretmen-paneli/kazanclar", email: false }, tx);
    });
    changed++;
  }

  // 3) Yenileme hatırlatması (sıradaki dönemi alınmamışsa)
  if (settings.subscriptionReminderDays > 0) {
    const soon = await db.questionSubscription.findMany({
      where: { status: "ACTIVE", renewalReminderAt: null, startsAt: { lte: now }, endsAt: { gt: now, lte: new Date(now.getTime() + settings.subscriptionReminderDays * DAY) } },
      take: 200,
    });
    for (const sub of soon) {
      const next = await db.questionSubscription.count({ where: { studentId: sub.studentId, teacherId: sub.teacherId, levelId: sub.levelId, subjectId: sub.subjectId, status: "ACTIVE", startsAt: { gte: sub.endsAt! } } });
      await db.questionSubscription.update({ where: { id: sub.id }, data: { renewalReminderAt: now } });
      if (next) continue;
      await notify({ userId: sub.studentId, type: "subscription.renewal", title: "Soru aboneliğiniz bitiyor", body: `${sub.levelName} ${sub.subjectName} aboneliğiniz ${formatDate(sub.endsAt!)} tarihinde bitiyor. Kesintisiz devam etmek için yenileyebilirsiniz.`, link: `/hesabim/abonelikler/${sub.id}` });
      changed++;
    }
  }

  // 4) Ödenmeyen talepler
  const stale = await db.questionSubscription.updateMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - HOUR) } }, data: { status: "EXPIRED" } });
  return changed + stale.count;
}

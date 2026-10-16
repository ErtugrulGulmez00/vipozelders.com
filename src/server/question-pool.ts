import type { PoolQuestion, Prisma } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { maskContacts } from "@/lib/text";
import { creditBalance, CreditError, lockStudentCredits, newCode, spendCredit } from "./credits";
import { db, type DbTransaction } from "./db";
import { addLedgerEntry } from "./ledger";
import { notify, notifyRole } from "./notifications";
import { settledReleaseAt } from "./pricing";
import { loadSettings, type SiteSettings } from "./settings";
import { deleteUpload, saveUpload, UploadError } from "./storage";

// Soru havuzu: öğrenci 1 kredi karşılığı soru gönderir; kademe ve derse uygun öğretmenler görür, biri üstlenir
// (kilit), çözer. Öğretmenin payı itiraz süresi ve ödeme kuruluşu aktarım süresi dolunca serbest kalır.
// Çözülmeyen, geri çevrilen ya da itirazı haklı bulunan sorunun kredisi iade edilir.

const HOUR = 3_600_000;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 25 * 1024 * 1024;
const MAX_ACTIVE_CLAIMS = 3;
const MIN_ANSWER_CHARS = 20;

export class PoolError extends Error {}

async function upload(file: File, kind: "image" | "video") {
  try {
    return await saveUpload(file, { visibility: "private", folder: "soru-havuzu", maxBytes: kind === "image" ? IMAGE_MAX : VIDEO_MAX, kinds: [kind] });
  } catch (error) {
    if (error instanceof UploadError) throw new PoolError(error.message);
    throw error;
  }
}

const hasFile = (file: File | null | undefined): file is File => Boolean(file && file.size > 0);

async function returnCredit(tx: DbTransaction, question: Pick<PoolQuestion, "id" | "studentId" | "purchaseId">, note: string) {
  await tx.creditLedger.create({ data: { studentId: question.studentId, purchaseId: question.purchaseId, questionId: question.id, kind: "RETURN", amount: 1, note } });
}

/** Durum değişimi yalnızca beklenen durumdaysa yapılır (yarış koşulunda ikinci işlem hata alır). */
async function move(tx: DbTransaction, id: string, from: PoolQuestion["status"][], data: Prisma.PoolQuestionUncheckedUpdateManyInput) {
  const updated = await tx.poolQuestion.updateMany({ where: { id, status: { in: from } }, data });
  if (updated.count !== 1) throw new PoolError("Sorunun durumu değişmiş. Sayfayı yenileyin.");
}

// ---------------------------------------------------------------------------
// Öğretmen uygunluğu
// ---------------------------------------------------------------------------

/** Havuzdan soru çözebilecek öğretmen koşulları (kademe + ders eşleşmesi ayrıca aranır). */
export function poolTeacherWhere(settings: SiteSettings): Prisma.TeacherProfileWhereInput {
  return { status: "PUBLISHED", answersPool: true, user: { status: "ACTIVE" }, ...(settings.poolVerifiedOnly ? { verificationStatus: "VERIFIED" as const } : {}) };
}

/** Kalite: çok düşük puanlı ya da itirazları sık haklı çıkan öğretmen havuzdan çıkar. */
export async function teacherPoolStanding(teacherId: string, now = new Date()) {
  const [rated, upheld] = await Promise.all([
    db.poolQuestion.findMany({ where: { claimedById: teacherId, rating: { not: null } }, orderBy: { ratedAt: "desc" }, take: 20, select: { rating: true } }),
    db.poolQuestion.count({ where: { claimedById: teacherId, status: "REFUNDED", resolvedAt: { gte: new Date(now.getTime() - 30 * 24 * HOUR) } } }),
  ]);
  const avg = rated.length ? rated.reduce((t, r) => t + (r.rating ?? 0), 0) / rated.length : null;
  const blocked = (rated.length >= 10 && avg !== null && avg < 3) || upheld >= 3;
  return { avg, ratings: rated.length, upheldDisputes: upheld, blocked };
}

/** Öğretmenin havuz eşleşmeleri (aktif dersleri: kademe + ders çiftleri). */
export async function teacherPoolPairs(teacherId: string) {
  const settings = await loadSettings();
  const teacher = await db.teacherProfile.findFirst({ where: { userId: teacherId, ...poolTeacherWhere(settings) }, select: { offerings: { where: { isActive: true }, select: { levelId: true, subjectId: true } } } });
  if (!teacher) return { eligible: false as const, pairs: [] };
  const pairs = [...new Map(teacher.offerings.map((o) => [`${o.levelId}:${o.subjectId}`, { levelId: o.levelId, subjectId: o.subjectId }])).values()];
  return { eligible: true as const, pairs };
}

// ---------------------------------------------------------------------------
// Öğrenci
// ---------------------------------------------------------------------------

export async function askPoolQuestion(studentId: string, input: { levelId: number; subjectId: number; note: string | null; image: File | null }, now = new Date()) {
  const settings = await loadSettings();
  if (!hasFile(input.image)) throw new PoolError("Sorunun fotoğrafını ekleyin.");
  const pair = await db.levelSubject.findUnique({ where: { levelId_subjectId: { levelId: input.levelId, subjectId: input.subjectId } }, include: { level: true, subject: true } });
  if (!pair) throw new PoolError("Seçtiğiniz ders bu kademede yok.");
  if ((await creditBalance(studentId, db, now)) < 1) throw new CreditError("Soru krediniz yok. Önce kredi paketi alın.");
  const imageKey = await upload(input.image, "image");
  try {
    const question = await db.$transaction(async (tx) => {
      await lockStudentCredits(tx, studentId);
      const purchaseId = await spendCredit(tx, studentId, now);
      const q = await tx.poolQuestion.create({
        data: {
          code: newCode("SH"),
          studentId,
          purchaseId,
          levelId: pair.levelId,
          subjectId: pair.subjectId,
          levelName: pair.level.name,
          subjectName: pair.subject.name,
          note: input.note ? maskContacts(input.note.trim()).slice(0, 1000) : null,
          imageKey,
          expiresAt: new Date(now.getTime() + settings.questionAnswerHours * HOUR),
          teacherFee: settings.poolTeacherFeeTl * 100,
        },
      });
      await tx.creditLedger.create({ data: { studentId, purchaseId, questionId: q.id, kind: "SPEND", amount: -1, note: `${q.code} gönderildi` } });
      return q;
    });
    // Uygun öğretmenlere haber (site içi bildirim)
    const teachers = await db.teacherProfile.findMany({
      where: { ...poolTeacherWhere(settings), offerings: { some: { isActive: true, levelId: question.levelId, subjectId: question.subjectId } } },
      select: { userId: true },
      take: 50,
    });
    if (teachers.length) {
      await db.notification.createMany({
        data: teachers.map((t) => ({ userId: t.userId, type: "pool.new", title: `Havuzda yeni soru: ${question.levelName} ${question.subjectName}`, body: "İlk üstlenen çözer.", link: `/ogretmen-paneli/soru-havuzu/${question.id}` })),
      });
    }
    return question;
  } catch (error) {
    await deleteUpload(imageKey);
    throw error;
  }
}

async function studentQuestion(studentId: string, id: string) {
  const q = await db.poolQuestion.findUnique({ where: { id } });
  if (!q || q.studentId !== studentId) throw new PoolError("Soru bulunamadı.");
  return q;
}

/** Henüz kimse üstlenmediyse öğrenci soruyu geri çeker; kredi iade edilir. */
export async function cancelPoolQuestion(studentId: string, id: string) {
  const q = await studentQuestion(studentId, id);
  await db.$transaction(async (tx) => {
    await move(tx, id, ["OPEN"], { status: "CANCELLED" });
    await returnCredit(tx, q, `${q.code} geri çekildi`);
  });
}

export async function askFollowUp(studentId: string, id: string, text: string, now = new Date()) {
  const q = await studentQuestion(studentId, id);
  if (q.status !== "ANSWERED" || (q.disputeUntil && q.disputeUntil <= now)) throw new PoolError("Bu soruya artık ek soru sorulamaz.");
  if (q.followUpText) throw new PoolError("Her soru için bir kez ek soru sorabilirsiniz.");
  const body = maskContacts(text.trim()).slice(0, 1000);
  if (body.length < 3) throw new PoolError("Takıldığınız yeri yazın.");
  await db.poolQuestion.update({ where: { id }, data: { followUpText: body, followUpAt: now } });
  if (q.claimedById) await notify({ userId: q.claimedById, type: "pool.followup", title: `${q.code}: öğrencinin ek sorusu`, body: body.slice(0, 140), link: `/ogretmen-paneli/soru-havuzu/${id}` });
}

export async function ratePoolAnswer(studentId: string, id: string, rating: number, now = new Date()) {
  const q = await studentQuestion(studentId, id);
  if (!["ANSWERED", "CLOSED"].includes(q.status)) throw new PoolError("Yalnızca çözülen sorular puanlanabilir.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new PoolError("Puan 1 ile 5 arasında olmalı.");
  await db.poolQuestion.update({ where: { id }, data: { rating, ratedAt: now } });
}

export async function disputePoolAnswer(studentId: string, id: string, reason: string, now = new Date()) {
  const q = await studentQuestion(studentId, id);
  if (q.status !== "ANSWERED" || !q.disputeUntil || q.disputeUntil <= now) throw new PoolError("Bu çözüm için sorun bildirme süresi doldu.");
  const text = reason.trim().slice(0, 1000);
  if (text.length < 10) throw new PoolError("Çözümde neyin yanlış ya da eksik olduğunu kısaca yazın.");
  await db.$transaction(async (tx) => {
    await move(tx, id, ["ANSWERED"], { status: "DISPUTED", disputeReason: text, disputedAt: now });
    await notifyRole("ADMIN", { type: "admin.pool_dispute", title: `Soru çözümüne itiraz: ${q.code}`, body: text.slice(0, 160), link: `/yonetim/soru-havuzu?itiraz=${id}`, email: false }, tx);
  });
}

// ---------------------------------------------------------------------------
// Öğretmen
// ---------------------------------------------------------------------------

async function teacherCanSee(teacherId: string, q: Pick<PoolQuestion, "levelId" | "subjectId">) {
  const { eligible, pairs } = await teacherPoolPairs(teacherId);
  return eligible && pairs.some((p) => p.levelId === q.levelId && p.subjectId === q.subjectId);
}

/** Öğretmenin görebileceği soru: havuzdaki açık soru (eşleşen kademe/ders) ya da kendi üstlendiği. */
export async function teacherQuestion(teacherId: string, id: string) {
  const q = await db.poolQuestion.findUnique({ where: { id } });
  if (!q) throw new PoolError("Soru bulunamadı.");
  if (q.claimedById === teacherId) return q;
  if (q.status === "OPEN" && (await teacherCanSee(teacherId, q))) return q;
  throw new PoolError("Bu soru başka bir öğretmende ya da havuzdan çıktı.");
}

export async function claimPoolQuestion(teacherId: string, id: string, now = new Date()) {
  const settings = await loadSettings();
  const q = await db.poolQuestion.findUnique({ where: { id } });
  if (!q || q.status !== "OPEN" || q.expiresAt <= now) throw new PoolError("Bu soru artık havuzda değil.");
  if (!(await teacherCanSee(teacherId, q))) throw new PoolError("Bu soru sizin ders verdiğiniz kademe ve derste değil.");
  const standing = await teacherPoolStanding(teacherId, now);
  if (standing.blocked) throw new PoolError("Puanınız ya da haklı bulunan itirazlar nedeniyle soru havuzuna erişiminiz geçici olarak kapalı. Destek ekibiyle görüşün.");
  const active = await db.poolQuestion.count({ where: { claimedById: teacherId, status: "CLAIMED" } });
  if (active >= MAX_ACTIVE_CLAIMS) throw new PoolError(`Aynı anda en fazla ${MAX_ACTIVE_CLAIMS} soru üstlenebilirsiniz; önce elinizdekileri çözün.`);
  const claimExpiresAt = new Date(Math.min(now.getTime() + settings.poolClaimMinutes * 60_000, q.expiresAt.getTime()));
  await db.$transaction((tx) => move(tx, id, ["OPEN"], { status: "CLAIMED", claimedById: teacherId, claimedAt: now, claimExpiresAt }));
}

export async function releasePoolClaim(teacherId: string, id: string) {
  const q = await teacherQuestion(teacherId, id);
  if (q.status !== "CLAIMED" || q.claimedById !== teacherId) throw new PoolError("Bu soru sizde değil.");
  await db.$transaction((tx) => move(tx, id, ["CLAIMED"], { status: "OPEN", claimedById: null, claimedAt: null, claimExpiresAt: null }));
}

/** Soru tek soru değilse / okunmuyorsa öğretmen geri çevirir: kredi iade, öğretmene ödeme yok. */
export async function rejectPoolQuestion(teacherId: string, id: string, reason: string) {
  const q = await teacherQuestion(teacherId, id);
  if (q.status !== "CLAIMED" || q.claimedById !== teacherId) throw new PoolError("Önce soruyu üstlenin.");
  const text = reason.trim().slice(0, 300) || "Soru çözülebilir durumda değil.";
  await db.$transaction(async (tx) => {
    await move(tx, id, ["CLAIMED"], { status: "REJECTED", rejectReason: text });
    await returnCredit(tx, q, `${q.code} geri çevrildi`);
    await notify({ userId: q.studentId, type: "pool.rejected", title: `${q.code}: soru çözülemedi, krediniz iade edildi`, body: `Öğretmenin notu: “${text}”. Soruyu net ve tek soru olacak şekilde tekrar gönderebilirsiniz.`, link: `/hesabim/sorularim/${id}` }, tx);
  });
}

export async function answerPoolQuestion(teacherId: string, id: string, input: { text: string; image: File | null; video: File | null }, now = new Date()) {
  const settings = await loadSettings();
  const q = await db.poolQuestion.findUnique({ where: { id }, include: { purchase: { select: { paidAt: true } } } });
  if (!q || q.claimedById !== teacherId || q.status !== "CLAIMED") throw new PoolError("Bu soru sizde değil ya da süresi doldu; havuzdan tekrar üstlenin.");
  const text = maskContacts(input.text.trim()).slice(0, 5000);
  if (text.length < MIN_ANSWER_CHARS) throw new PoolError(`Çözümü en az birkaç cümleyle açıklayın (en az ${MIN_ANSWER_CHARS} karakter); yalnızca şık yazmak yeterli değil.`);
  const imageKey = hasFile(input.image) ? await upload(input.image, "image") : null;
  const videoKey = hasFile(input.video) ? await upload(input.video, "video") : null;
  const disputeUntil = new Date(now.getTime() + settings.disputeWindowHours * HOUR);
  const releaseAt = settledReleaseAt(disputeUntil, q.purchase.paidAt, settings.settlementDays);
  try {
    await db.$transaction(async (tx) => {
      await move(tx, id, ["CLAIMED"], { status: "ANSWERED", answerText: text, answerImageKey: imageKey, answerVideoKey: videoKey, answeredAt: now, disputeUntil, releaseAt, claimExpiresAt: null });
      await addLedgerEntry(tx, { teacherId, poolQuestionId: id, bucket: "PENDING", amount: q.teacherFee, description: `${q.code} soru çözümü` });
      await notify({ userId: q.studentId, type: "pool.answered", title: `${q.code}: sorunuzun çözümü geldi`, body: `${q.levelName} ${q.subjectName}. Anlamadığınız yeri bir kez sorabilir, ${formatDateTime(disputeUntil)} saatine kadar sorun bildirebilirsiniz.`, link: `/hesabim/sorularim/${id}` }, tx);
      await notify({ userId: teacherId, type: "pool.paid", title: "Çözüm gönderildi", body: `${q.code} · ${formatMoney(q.teacherFee)} hakedişiniz ${formatDateTime(releaseAt)} sonrasında serbest kalacak.`, link: "/ogretmen-paneli/kazanclar", email: false }, tx);
    });
  } catch (error) {
    await deleteUpload(imageKey);
    await deleteUpload(videoKey);
    throw error;
  }
}

export async function answerFollowUp(teacherId: string, id: string, text: string, now = new Date()) {
  const q = await db.poolQuestion.findUnique({ where: { id } });
  if (!q || q.claimedById !== teacherId) throw new PoolError("Soru bulunamadı.");
  if (!q.followUpText || q.followUpAnswer) throw new PoolError("Cevaplanacak ek soru yok.");
  const body = maskContacts(text.trim()).slice(0, 3000);
  if (body.length < 5) throw new PoolError("Cevabı yazın.");
  await db.poolQuestion.update({ where: { id }, data: { followUpAnswer: body, followUpAnsweredAt: now } });
  await notify({ userId: q.studentId, type: "pool.followup_answered", title: `${q.code}: ek sorunuz cevaplandı`, body: body.slice(0, 140), link: `/hesabim/sorularim/${id}` });
}

// ---------------------------------------------------------------------------
// Yönetici
// ---------------------------------------------------------------------------

/** İtiraz kararı: haklıysa kredi iade, öğretmen hakedişi geri alınır; değilse çözüm geçerli sayılır. */
export async function resolvePoolDispute(adminId: string, id: string, upheld: boolean, note: string, now = new Date()) {
  const q = await db.poolQuestion.findUnique({ where: { id } });
  if (!q || q.status !== "DISPUTED") throw new PoolError("Bu soruda açık itiraz yok.");
  const text = note.trim().slice(0, 500) || (upheld ? "İtiraz haklı bulundu." : "Çözüm yeterli bulundu.");
  await db.$transaction(async (tx) => {
    if (upheld) {
      await move(tx, id, ["DISPUTED"], { status: "REFUNDED", resolutionNote: text, resolvedAt: now });
      await returnCredit(tx, q, `${q.code} itiraz sonucu iade`);
      if (q.claimedById) await addLedgerEntry(tx, { teacherId: q.claimedById, poolQuestionId: id, bucket: "PENDING", amount: -q.teacherFee, description: `${q.code} itiraz haklı bulundu` });
    } else {
      await move(tx, id, ["DISPUTED"], { status: "ANSWERED", resolutionNote: text, resolvedAt: now });
    }
    await tx.auditLog.create({ data: { actorId: adminId, action: upheld ? "pool.dispute_upheld" : "pool.dispute_rejected", entityType: "PoolQuestion", entityId: id, details: { note: text } } });
    await notify({ userId: q.studentId, type: "pool.dispute_resolved", title: `${q.code}: itirazınız sonuçlandı`, body: upheld ? `Krediniz iade edildi. ${text}` : `Çözüm yeterli bulundu. ${text}`, link: `/hesabim/sorularim/${id}` }, tx);
    if (q.claimedById) await notify({ userId: q.claimedById, type: "pool.dispute_resolved", title: `${q.code}: itiraz sonuçlandı`, body: upheld ? `İtiraz haklı bulundu; bu sorudan hakediş oluşmadı. ${text}` : `Çözümünüz yeterli bulundu. ${text}`, link: `/ogretmen-paneli/soru-havuzu/${id}`, email: false }, tx);
  });
}

// ---------------------------------------------------------------------------
// Zamanlayıcı
// ---------------------------------------------------------------------------

/** Kilit süresi dolan (çözülmeyen) sorular havuza döner. */
export async function releaseExpiredClaims(now = new Date()): Promise<number> {
  const result = await db.poolQuestion.updateMany({ where: { status: "CLAIMED", claimExpiresAt: { lte: now }, expiresAt: { gt: now } }, data: { status: "OPEN", claimedById: null, claimedAt: null, claimExpiresAt: null } });
  return result.count;
}

/** Süresinde çözülmeyen soruların kredisi iade edilir. */
export async function expireUnansweredQuestions(now = new Date()): Promise<number> {
  const due = await db.poolQuestion.findMany({ where: { status: { in: ["OPEN", "CLAIMED"] }, expiresAt: { lte: now } }, take: 200 });
  let count = 0;
  for (const q of due) {
    try {
      await db.$transaction(async (tx) => {
        await move(tx, q.id, ["OPEN", "CLAIMED"], { status: "EXPIRED", claimExpiresAt: null });
        await returnCredit(tx, q, `${q.code} süresinde çözülmedi`);
        await notify({ userId: q.studentId, type: "pool.expired", title: `${q.code}: sorunuz süresinde çözülemedi`, body: "Krediniz iade edildi; isterseniz soruyu tekrar gönderebilirsiniz.", link: `/hesabim/sorularim/${q.id}` }, tx);
      });
      count++;
    } catch {
      continue;
    }
  }
  return count;
}

/** İtiraz ve ödeme aktarım süresi dolan çözümler kapanır; öğretmen hakedişi ödenebilir bakiyeye geçer. */
export async function releasePoolEarnings(now = new Date()): Promise<number> {
  const due = await db.poolQuestion.findMany({ where: { status: "ANSWERED", releaseAt: { lte: now }, releasedAt: null }, take: 200 });
  let count = 0;
  for (const q of due) {
    try {
      await db.$transaction(async (tx) => {
        await move(tx, q.id, ["ANSWERED"], { status: "CLOSED", releasedAt: now });
        if (q.claimedById && q.teacherFee > 0) {
          await addLedgerEntry(tx, { teacherId: q.claimedById, poolQuestionId: q.id, bucket: "PENDING", amount: -q.teacherFee, description: `${q.code} hakediş serbest bırakıldı` });
          await addLedgerEntry(tx, { teacherId: q.claimedById, poolQuestionId: q.id, bucket: "AVAILABLE", amount: q.teacherFee, description: `${q.code} soru çözümü` });
        }
      });
      count++;
    } catch {
      continue;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Listeler
// ---------------------------------------------------------------------------

/** Soru gönderilebilecek kademe/ders çiftleri: havuza katılan en az bir uygun öğretmeni olanlar. */
export async function poolSubjects() {
  const settings = await loadSettings();
  const offerings = await db.teacherOffering.findMany({
    where: { isActive: true, teacher: poolTeacherWhere(settings), level: { isActive: true }, subject: { isActive: true } },
    distinct: ["levelId", "subjectId"],
    select: { levelId: true, subjectId: true, level: { select: { name: true, sortOrder: true } }, subject: { select: { name: true, sortOrder: true } } },
  });
  return offerings
    .sort((a, b) => a.level.sortOrder - b.level.sortOrder || a.subject.sortOrder - b.subject.sortOrder || a.subject.name.localeCompare(b.subject.name, "tr"))
    .map((o) => ({ value: `${o.levelId}:${o.subjectId}`, levelName: o.level.name, subjectName: o.subject.name }));
}

/** Öğretmen havuz ekranı: eşleşen açık sorular, elindekiler ve son çözdükleri. */
export async function teacherPoolFeed(teacherId: string, now = new Date()) {
  const { eligible, pairs } = await teacherPoolPairs(teacherId);
  const [open, mine, standing] = await Promise.all([
    eligible && pairs.length
      ? db.poolQuestion.findMany({
          where: { status: "OPEN", expiresAt: { gt: now }, OR: pairs.map((p) => ({ levelId: p.levelId, subjectId: p.subjectId })) },
          orderBy: { createdAt: "asc" },
          take: 50,
        })
      : Promise.resolve([]),
    db.poolQuestion.findMany({ where: { claimedById: teacherId }, orderBy: { claimedAt: "desc" }, take: 30 }),
    teacherPoolStanding(teacherId, now),
  ]);
  return { eligible, open, mine, standing };
}

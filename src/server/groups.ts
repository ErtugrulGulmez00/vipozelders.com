import { randomUUID } from "node:crypto";
import type { GroupCourse, GroupEnrollment, GroupSession, Prisma } from "@/generated/prisma/client";
import { addDaysToDateString, formatDateTime, formatLessonRange, isoWeekday, zonedDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { maskContacts } from "@/lib/text";
import { newCode } from "./credits";
import { db, type DbTransaction } from "./db";
import { appUrl } from "./email";
import { addLedgerEntry } from "./ledger";
import { notify, notifyRole } from "./notifications";
import { getPaymentProvider, getProviderById, PAYMENT_PROVIDERS, processRefund, salesOpen } from "./payments/service";
import { settledReleaseAt, splitCommission } from "./pricing";
import { DiscountError, recordPaidOrder, resolveDiscount } from "./discounts";
import { loadSettings } from "./settings";
import { teacherPlanPairs } from "./subscriptions";
import { videoConfigured } from "./video-config";

// Grup dersi (sanal dershane). Öğretmen oturumlardan oluşan bir program ilan eder; öğrenci kişi başı ücreti öder.
// Kayıt bitişinde en az katılımcı dolmazsa ders iptal olur, herkese tam iade yapılır. Öğretmen payı her oturum
// yapıldıkça o oturumun payı kadar serbest kalır; öğretmenin katılmadığı oturumun payı öğrencilere iade edilir.
// İlk oturum başlamadan öğrenci kaydını iptal ederse tam iade alır; sonrasında iade yoktur.

const HOUR = 3_600_000;
const MAX_SESSIONS = 40;
const CLOSE_AFTER_MINUTES = 15;

export class GroupError extends Error {}

type Tx = DbTransaction | typeof db;

/** Toplamın n oturuma bölünmüş i. payı (kuruşlar kaybolmaz; son oturum kalanı alır). */
export function sessionShare(total: number, count: number, index: number): number {
  if (count <= 0) return 0;
  return Math.floor((total * (index + 1)) / count) - Math.floor((total * index) / count);
}

async function lockCourse(tx: DbTransaction, courseId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`group:${courseId}`}))`;
}

/** Öğretmenin takvim kilidi: randevu oluşturma ile aynı anahtar (çakışan saat iki yerden aynı anda alınamaz). */
async function lockTeacherCalendar(tx: DbTransaction, teacherId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${teacherId}))`;
}

/** Öğretmenin takvimini dolduran grup oturumları (randevu boş saat hesabına eklenir). */
export async function groupBusy(tx: Tx, teacherId: string, from: Date, to: Date) {
  const rows = await tx.groupSession.findMany({
    where: { status: "SCHEDULED", startAt: { lt: to }, endAt: { gt: from }, course: { teacherId, status: { in: ["OPEN", "CONFIRMED"] } } },
    select: { startAt: true, endAt: true },
  });
  return rows.map((r) => ({ start: r.startAt, end: r.endAt }));
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export type ScheduleInput = { firstDate: string; weekdays: number[]; startMinute: number; durationMinutes: number; weeks: number };

/** Haftalık programdan oturum saatleri: ilk günden başlayarak seçilen hafta günlerinde, verilen hafta sayısı kadar. */
export function buildSchedule(input: ScheduleInput): { startAt: Date; endAt: Date }[] {
  const days = new Set(input.weekdays);
  const sessions: { startAt: Date; endAt: Date }[] = [];
  for (let d = 0; d < input.weeks * 7; d++) {
    const date = addDaysToDateString(input.firstDate, d);
    if (!days.has(isoWeekday(date))) continue;
    const startAt = zonedDateTime(date, input.startMinute);
    sessions.push({ startAt, endAt: new Date(startAt.getTime() + input.durationMinutes * 60_000) });
  }
  return sessions;
}

export type CourseInput = {
  levelId: number;
  subjectId: number;
  title: string;
  description: string | null;
  priceTl: number;
  capacity: number;
  minParticipants: number;
  enrollDeadline: Date;
  isPublic: boolean;
  schedule: ScheduleInput;
};

export async function createGroupCourse(teacherId: string, input: CourseInput, now = new Date()) {
  const settings = await loadSettings();
  if (!settings.groupsEnabled) throw new GroupError("Grup dersi şu an kapalı.");
  const teacher = await db.teacherProfile.findUnique({ where: { userId: teacherId }, include: { user: { select: { status: true } } } });
  if (!teacher || teacher.user.status !== "ACTIVE") throw new GroupError("Öğretmen hesabı bulunamadı.");
  const pairs = await teacherPlanPairs(teacherId);
  if (!pairs.some((p) => p.levelId === input.levelId && p.subjectId === input.subjectId)) throw new GroupError("Bu kademe ve ders, verdiğiniz dersler arasında yok.");
  const title = maskContacts(input.title.trim()).slice(0, 120);
  if (title.length < 5) throw new GroupError("Ders için açıklayıcı bir başlık yazın (ör. LGS Matematik Kampı).");
  if (!Number.isInteger(input.priceTl) || input.priceTl < settings.groupMinPriceTl || input.priceTl > settings.groupMaxPriceTl) {
    throw new GroupError(`Kişi başı ücret ${formatMoney(settings.groupMinPriceTl * 100)} ile ${formatMoney(settings.groupMaxPriceTl * 100)} arasında olmalı.`);
  }
  if (!Number.isInteger(input.capacity) || input.capacity < settings.groupMinParticipants || input.capacity > settings.groupMaxCapacity) {
    throw new GroupError(`Kontenjan ${settings.groupMinParticipants} ile ${settings.groupMaxCapacity} kişi arasında olmalı.`);
  }
  if (!Number.isInteger(input.minParticipants) || input.minParticipants < settings.groupMinParticipants || input.minParticipants > input.capacity) {
    throw new GroupError(`En az katılımcı ${settings.groupMinParticipants} ile kontenjan arasında olmalı.`);
  }
  const { durationMinutes, weeks, startMinute } = input.schedule;
  if (!input.schedule.weekdays.length) throw new GroupError("Dersin yapılacağı günleri seçin.");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 240) throw new GroupError("Oturum süresi 30 ile 240 dakika arasında olmalı.");
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 12) throw new GroupError("Program 1 ile 12 hafta arasında olmalı.");
  if (!Number.isInteger(startMinute) || startMinute < 6 * 60 || startMinute + durationMinutes > 24 * 60) throw new GroupError("Başlangıç saatini kontrol edin.");
  const sessions = buildSchedule(input.schedule);
  if (!sessions.length) throw new GroupError("Seçtiğiniz tarih ve günlerde oturum oluşmadı.");
  if (sessions.length > MAX_SESSIONS) throw new GroupError(`En fazla ${MAX_SESSIONS} oturum planlanabilir.`);
  const first = sessions[0].startAt;
  if (input.enrollDeadline.getTime() < now.getTime() + HOUR) throw new GroupError("Kayıt bitişi en az 1 saat sonrası olmalı.");
  if (input.enrollDeadline > first) throw new GroupError(`Kayıt bitişi ilk oturumdan (${formatDateTime(first)}) önce olmalı.`);

  return db.$transaction(async (tx) => {
    await lockTeacherCalendar(tx, teacherId);
    const from = first;
    const to = sessions[sessions.length - 1].endAt;
    const [bookings, groups] = await Promise.all([
      tx.booking.findMany({
        where: {
          teacherId,
          mode: { not: "QUESTION" },
          startAt: { lt: to },
          blockEndAt: { gt: from },
          OR: [{ status: { in: ["PENDING_APPROVAL", "CONFIRMED"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
        },
        select: { startAt: true, blockEndAt: true },
      }),
      groupBusy(tx, teacherId, from, to),
    ]);
    const busy = [...bookings.map((b) => ({ start: b.startAt, end: b.blockEndAt })), ...groups];
    const clash = sessions.find((s) => busy.some((b) => s.startAt < b.end && b.start < s.endAt));
    if (clash) throw new GroupError(`${formatLessonRange(clash.startAt, clash.endAt)} saatinde başka bir dersiniz var. Programı değiştirin.`);
    const pair = pairs.find((p) => p.levelId === input.levelId && p.subjectId === input.subjectId)!;
    const [levelName, subjectName] = pair.label.split(" · ");
    return tx.groupCourse.create({
      data: {
        code: newCode("GD"),
        teacherId,
        levelId: input.levelId,
        subjectId: input.subjectId,
        levelName,
        subjectName,
        title,
        description: input.description ? maskContacts(input.description.trim()).slice(0, 2000) || null : null,
        price: input.priceTl * 100,
        commissionRateBps: settings.groupCommissionBps,
        capacity: input.capacity,
        minParticipants: input.minParticipants,
        enrollDeadline: input.enrollDeadline,
        isPublic: input.isPublic,
        sessions: { create: sessions.map((s, index) => ({ index, startAt: s.startAt, endAt: s.endAt, videoRoomName: `grup-${randomUUID()}` })) },
      },
    });
  });
}

/** Ödenmiş ve süresi geçmemiş ödeme bekleyen kayıtlar yer tutar. */
export async function seatsTaken(courseId: string, now = new Date(), tx: Tx = db) {
  return tx.groupEnrollment.count({ where: { courseId, OR: [{ status: "PAID" }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }] } });
}

export async function paidCount(courseId: string, tx: Tx = db) {
  return tx.groupEnrollment.count({ where: { courseId, status: "PAID" } });
}

// ---------------------------------------------------------------------------
// Davet ve kayıt
// ---------------------------------------------------------------------------

export async function inviteToGroup(teacherId: string, courseId: string, emailOrUsername: string, now = new Date()) {
  const course = await db.groupCourse.findUnique({ where: { id: courseId } });
  if (!course || course.teacherId !== teacherId) throw new GroupError("Ders bulunamadı.");
  if (course.status !== "OPEN" || course.enrollDeadline <= now) throw new GroupError("Bu dersin kayıtları kapandı.");
  const key = emailOrUsername.trim().toLocaleLowerCase("tr-TR");
  const student = await db.user.findFirst({ where: { role: "STUDENT", status: "ACTIVE", OR: [{ email: key }, { username: key }] } });
  if (!student) throw new GroupError("Bu e-postayla kayıtlı bir veli/öğrenci hesabı bulunamadı. Öğrencinizden önce siteye ücretsiz üye olmasını isteyin.");
  const existing = await db.groupEnrollment.findUnique({ where: { courseId_studentId: { courseId, studentId: student.id } } });
  if (existing?.status === "PAID") throw new GroupError("Bu öğrenci derse zaten kayıtlı.");
  const { commissionAmount, teacherAmount } = splitCommission(course.price, course.commissionRateBps);
  if (existing) {
    await db.groupEnrollment.update({ where: { id: existing.id }, data: { status: existing.status === "PENDING_PAYMENT" ? existing.status : "INVITED", invitedAt: now } });
  } else {
    await db.groupEnrollment.create({ data: { code: newCode("GK"), courseId, studentId: student.id, status: "INVITED", price: course.price, commissionAmount, teacherAmount, invitedAt: now } });
  }
  await notify({
    userId: student.id,
    type: "group.invited",
    title: `Grup dersine davet: ${course.title}`,
    body: `${course.levelName} ${course.subjectName} · kişi başı ${formatMoney(course.price)}. Kayıt için son gün: ${formatDateTime(course.enrollDeadline)}.`,
    link: `/grup-dersleri/${course.code}`,
  });
  return student;
}

/** Öğrencinin bu derse kayıt olabilmesi (yer ayırır, ödeme bekler). */
export async function enrollInGroup(studentId: string, courseId: string, learnerName: string | null, now = new Date(), couponCode?: string | null) {
  if (!salesOpen()) throw new GroupError("Online ödeme altyapımız çok yakında açılıyor; şu an grup dersi satışı yapılamıyor.");
  const settings = await loadSettings();
  if (!settings.groupsEnabled) throw new GroupError("Grup dersi şu an kapalı.");
  const student = await db.user.findUnique({ where: { id: studentId }, select: { role: true, email: true } });
  if (student?.role !== "STUDENT") throw new GroupError("Grup dersine yalnızca veli/öğrenci hesabıyla kayıt olunabilir.");
  if (!student.email) throw new GroupError("Ödeme için hesabınızda e-posta adresi olmalı.");
  return db.$transaction(async (tx) => {
    await lockCourse(tx, courseId);
    const course = await tx.groupCourse.findUnique({ where: { id: courseId }, include: { teacher: { include: { user: { select: { status: true } } } } } });
    if (!course || course.status !== "OPEN" || course.enrollDeadline <= now || course.teacher.user.status !== "ACTIVE") throw new GroupError("Bu dersin kayıtları kapandı.");
    if (course.teacherId === studentId) throw new GroupError("Kendi dersinize kayıt olamazsınız.");
    if (getPaymentProvider().requiresSubMerchant && !course.teacher.subMerchantKey) throw new GroupError("Öğretmenin ödeme hesabı henüz tamamlanmadığı için şu an kayıt alınamıyor.");
    const existing = await tx.groupEnrollment.findUnique({ where: { courseId_studentId: { courseId, studentId } } });
    if (existing?.status === "PAID") throw new GroupError("Bu derse zaten kayıtlısınız.");
    if (!course.isPublic && !existing) throw new GroupError("Bu derse yalnızca öğretmenin davet ettiği öğrenciler kayıt olabilir.");
    if ((await seatsTaken(courseId, now, tx)) - (existing?.status === "PENDING_PAYMENT" && existing.holdExpiresAt && existing.holdExpiresAt > now ? 1 : 0) >= course.capacity) {
      throw new GroupError("Kontenjan doldu.");
    }
    const split = splitCommission(course.price, course.commissionRateBps);
    const discount = await resolveDiscount(studentId, couponCode, "group", course.price, split.commissionAmount, now).catch((error: unknown) => {
      if (error instanceof DiscountError) throw new GroupError(error.message);
      throw error;
    });
    const data = {
      status: "PENDING_PAYMENT" as const,
      price: course.price - discount.amount,
      commissionAmount: split.commissionAmount - discount.amount,
      teacherAmount: split.teacherAmount,
      discountAmount: discount.amount,
      couponCode: discount.couponCode,
      learnerName: learnerName?.trim().slice(0, 80) || null,
      holdExpiresAt: new Date(now.getTime() + settings.paymentHoldMinutes * 60_000),
      cancelledAt: null,
    };
    if (existing) return tx.groupEnrollment.update({ where: { id: existing.id }, data });
    return tx.groupEnrollment.create({ data: { code: newCode("GK"), courseId, studentId, ...data } });
  });
}

export async function startGroupCheckout(enrollmentId: string, studentId: string, ipAddress: string): Promise<string> {
  const enrollment = await db.groupEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { student: { include: { studentProfile: { include: { city: true } } } }, course: { include: { teacher: { select: { subMerchantKey: true } } } } },
  });
  if (!enrollment || enrollment.studentId !== studentId) throw new GroupError("Kayıt bulunamadı.");
  if (enrollment.status !== "PENDING_PAYMENT") throw new GroupError("Bu kayıt için ödeme beklenmiyor.");
  const provider = getPaymentProvider();
  const payment = await db.payment.create({ data: { groupEnrollmentId: enrollment.id, provider: provider.id, amount: enrollment.price } });
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: enrollment.id,
      bookingCode: enrollment.code,
      amount: enrollment.price,
      description: `Grup dersi: ${enrollment.course.title}`.slice(0, 120),
      buyer: {
        id: enrollment.studentId,
        firstName: enrollment.student.firstName,
        lastName: enrollment.student.lastName,
        email: enrollment.student.email!,
        phone: enrollment.student.phone,
        ipAddress,
        city: enrollment.student.studentProfile?.city?.name ?? null,
        registeredAt: enrollment.student.createdAt,
      },
      teacher: { subMerchantKey: enrollment.course.teacher.subMerchantKey, amount: enrollment.teacherAmount },
      callbackUrl: appUrl(`/api/odeme/${provider.id}/donus`),
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerToken: session.token } });
    return session.redirectUrl;
  } catch (error) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: String(error).slice(0, 300) } });
    throw new GroupError("Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar deneyin.");
  }
}

async function createRefund(tx: DbTransaction, enrollmentId: string, amount: number, reason: string) {
  if (amount <= 0) return null;
  const payment = await tx.payment.findFirst({ where: { groupEnrollmentId: enrollmentId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, orderBy: { createdAt: "desc" } });
  if (!payment) throw new GroupError("Ödeme kaydı bulunamadı.");
  return (await tx.refund.create({ data: { paymentId: payment.id, amount, reason: reason.slice(0, 300) } })).id;
}

/** Ödeme dönüşü: yer hâlâ varsa kayıt kesinleşir; ders kapandıysa ya da kontenjan dolduysa ödeme iade edilir. */
export async function completeGroupCheckout(
  payment: { id: string; provider: string; status: string; groupEnrollmentId: string | null; providerToken: string | null },
  now = new Date(),
): Promise<"paid" | "failed" | "already" | "pending" | "refunded"> {
  if (!payment.groupEnrollmentId || !payment.providerToken) return "failed";
  if (payment.status !== "INITIATED") return "already";
  const result = await getProviderById(payment.provider).retrieveResult(payment.providerToken);
  if (result.status === "pending") return "pending";
  const raw = (result.raw ?? undefined) as Prisma.InputJsonValue | undefined;
  if (result.status === "failure") {
    await db.payment.updateMany({ where: { id: payment.id, status: "INITIATED" }, data: { status: "FAILED", failureReason: result.reason.slice(0, 300), raw } });
    await db.groupEnrollment.updateMany({ where: { id: payment.groupEnrollmentId, status: "PENDING_PAYMENT" }, data: { status: "FAILED", holdExpiresAt: null } });
    return "failed";
  }
  let refundId: string | null = null;
  const outcome = await db.$transaction(async (tx) => {
    const enrollment = await tx.groupEnrollment.findUniqueOrThrow({ where: { id: payment.groupEnrollmentId! } });
    await lockCourse(tx, enrollment.courseId);
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: "INITIATED" },
      data: { status: "SUCCEEDED", providerPaymentId: result.providerPaymentId, providerItemId: result.providerItemId, raw },
    });
    if (updated.count === 0) return "already" as const;
    if (result.paidAmount !== enrollment.price) throw new GroupError("Ödenen tutar ders ücretiyle uyuşmuyor.");
    const course = await tx.groupCourse.findUniqueOrThrow({ where: { id: enrollment.courseId } });
    const full = (await paidCount(course.id, tx)) >= course.capacity;
    const closed = course.status !== "OPEN" || course.enrollDeadline <= now;
    if (enrollment.status === "PAID" || full || closed) {
      // Ödeme sırasında yer kalmadı ya da kayıt kapandı: para kesildiği için hemen iade edilir.
      if (enrollment.status !== "PAID") await tx.groupEnrollment.update({ where: { id: enrollment.id }, data: { status: "CANCELLED", cancelledAt: now, holdExpiresAt: null, refundedAmount: { increment: enrollment.price }, paidAt: now } });
      refundId = await createRefund(tx, enrollment.id, enrollment.price, full ? "Grup dersi kontenjanı doldu" : "Grup dersi kayıtları kapandı");
      await notify({ userId: enrollment.studentId, type: "group.refunded", title: "Grup dersi kaydınız tamamlanamadı", body: `${course.title}: ${full ? "kontenjan siz ödeme yaparken doldu" : "kayıtlar kapandı"}. ${formatMoney(enrollment.price)} kartınıza iade ediliyor.`, link: `/grup-dersleri/${course.code}` }, tx);
      return "refunded" as const;
    }
    await tx.groupEnrollment.update({ where: { id: enrollment.id }, data: { status: "PAID", paidAt: now, holdExpiresAt: null } });
    await addLedgerEntry(tx, { teacherId: course.teacherId, groupEnrollmentId: enrollment.id, bucket: "PENDING", amount: enrollment.teacherAmount, description: `${enrollment.code} grup dersi (oturumlar yapıldıkça serbest kalır)` });
    await recordPaidOrder(tx, { userId: enrollment.studentId, targetType: "group", targetId: enrollment.id, discountAmount: enrollment.discountAmount, couponCode: enrollment.couponCode });
    const paid = await paidCount(course.id, tx);
    await notify({ userId: enrollment.studentId, type: "group.enrolled", title: "Grup dersine kaydınız tamamlandı", body: `${course.title}. ${paid >= course.minParticipants ? "Ders açılıyor; oturum saatlerinde “Derse katıl” düğmesi açılır." : `Ders en az ${course.minParticipants} kişi olunca açılır; ${formatDateTime(course.enrollDeadline)} tarihine kadar dolmazsa ücretin tamamı iade edilir.`}`, link: `/hesabim/grup-derslerim/${enrollment.id}` }, tx);
    await notify({ userId: course.teacherId, type: "group.enrolled", title: `Grup dersinize yeni kayıt (${paid}/${course.capacity})`, body: `${course.title}${paid === course.minParticipants ? " · en az katılımcı sayısına ulaşıldı" : ""}.`, link: `/ogretmen-paneli/grup-dersleri/${course.id}`, email: false }, tx);
    return "paid" as const;
  });
  if (refundId) await processRefund(refundId);
  return outcome;
}

// ---------------------------------------------------------------------------
// İptaller
// ---------------------------------------------------------------------------

/**
 * Bir kaydın henüz yapılmamış oturumlarının ücretini iade eder (transaction içinde). Öğretmenin bekleyen payı da
 * aynı oturumlar kadar düşülür. Dönen değer iade kaydının kimliği.
 */
async function refundRemaining(tx: DbTransaction, enrollment: GroupEnrollment, sessions: Pick<GroupSession, "index" | "status">[], reason: string, now: Date) {
  const scheduled = sessions.filter((s) => s.status === "SCHEDULED");
  const refund = Math.min(enrollment.price - enrollment.refundedAmount, scheduled.reduce((t, s) => t + sessionShare(enrollment.price, sessions.length, s.index), 0));
  const teacherCut = scheduled.reduce((t, s) => t + sessionShare(enrollment.teacherAmount, sessions.length, s.index), 0);
  await tx.groupEnrollment.update({ where: { id: enrollment.id }, data: { status: "CANCELLED", cancelledAt: now, refundedAmount: { increment: refund } } });
  if (teacherCut > 0) {
    const course = await tx.groupCourse.findUniqueOrThrow({ where: { id: enrollment.courseId }, select: { teacherId: true } });
    await addLedgerEntry(tx, { teacherId: course.teacherId, groupEnrollmentId: enrollment.id, bucket: "PENDING", amount: -teacherCut, description: `${enrollment.code} ${reason}` });
  }
  return createRefund(tx, enrollment.id, refund, reason);
}

/** Öğrenci kaydını iptal eder: ilk oturum başlamadan tam iade; davet/ödeme bekleyen kayıt yalnızca kapanır. */
export async function cancelEnrollment(studentId: string, enrollmentId: string, now = new Date()) {
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    const enrollment = await tx.groupEnrollment.findUnique({ where: { id: enrollmentId }, include: { course: { include: { sessions: { orderBy: { index: "asc" } } } } } });
    if (!enrollment || enrollment.studentId !== studentId) throw new GroupError("Kayıt bulunamadı.");
    await lockCourse(tx, enrollment.courseId);
    if (enrollment.status === "INVITED" || enrollment.status === "PENDING_PAYMENT") {
      await tx.groupEnrollment.update({ where: { id: enrollment.id }, data: { status: "CANCELLED", cancelledAt: now, holdExpiresAt: null } });
      return;
    }
    if (enrollment.status !== "PAID") throw new GroupError("Bu kayıt iptal edilemez.");
    const first = enrollment.course.sessions[0];
    if (!first || first.startAt <= now) throw new GroupError("Ders başladıktan sonra kayıt iptal edilemez ve iade yapılmaz.");
    refundId = await refundRemaining(tx, enrollment, enrollment.course.sessions, "öğrenci ders başlamadan kaydını iptal etti", now);
    await notify({ userId: enrollment.course.teacherId, type: "group.left", title: "Grup dersinizden bir kayıt iptal edildi", body: `${enrollment.course.title} · ${enrollment.code}`, link: `/ogretmen-paneli/grup-dersleri/${enrollment.courseId}`, email: false }, tx);
  });
  if (refundId) await processRefund(refundId);
}

/**
 * Dersi iptal eder: ödeme yapan herkese yapılmamış oturumların ücreti iade edilir. Öğretmen yalnızca ilk oturumdan
 * önce iptal edebilir; yönetici her zaman (yapılan oturumların payı öğretmende kalır).
 */
export async function cancelGroupCourse(courseId: string, reason: string, actor: { id: string; role: "TEACHER" | "ADMIN" } | null, now = new Date()) {
  const refundIds: string[] = [];
  await db.$transaction(async (tx) => {
    await lockCourse(tx, courseId);
    const course = await tx.groupCourse.findUnique({ where: { id: courseId }, include: { sessions: { orderBy: { index: "asc" } }, enrollments: true } });
    if (!course || (actor?.role === "TEACHER" && course.teacherId !== actor.id)) throw new GroupError("Ders bulunamadı.");
    if (course.status === "CANCELLED" || course.status === "COMPLETED") throw new GroupError("Bu ders zaten kapanmış.");
    if (actor?.role === "TEACHER" && course.sessions[0] && course.sessions[0].startAt <= now) throw new GroupError("Ders başladıktan sonra iptal için destek ekibine yazın.");
    for (const enrollment of course.enrollments) {
      if (enrollment.status === "PAID") {
        const id = await refundRemaining(tx, enrollment, course.sessions, `grup dersi iptal edildi: ${reason}`, now);
        if (id) refundIds.push(id);
        await notify({ userId: enrollment.studentId, type: "group.cancelled", title: "Grup dersi iptal edildi", body: `${course.title}: ${reason}. Yapılmamış oturumların ücreti kartınıza iade ediliyor.`, link: `/hesabim/grup-derslerim/${enrollment.id}` }, tx);
      } else if (enrollment.status === "INVITED" || enrollment.status === "PENDING_PAYMENT") {
        await tx.groupEnrollment.update({ where: { id: enrollment.id }, data: { status: "EXPIRED", holdExpiresAt: null } });
      }
    }
    await tx.groupSession.updateMany({ where: { courseId, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    await tx.groupCourse.update({ where: { id: courseId }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason.slice(0, 300) } });
    if (actor) await tx.auditLog.create({ data: { actorId: actor.id, action: "group.cancelled", entityType: "GroupCourse", entityId: courseId, details: { reason } } });
    if (actor?.role !== "TEACHER") await notify({ userId: course.teacherId, type: "group.cancelled", title: "Grup dersiniz iptal edildi", body: `${course.title}: ${reason}.`, link: `/ogretmen-paneli/grup-dersleri/${courseId}` }, tx);
  });
  for (const id of refundIds) await processRefund(id);
}

// ---------------------------------------------------------------------------
// Sanal sınıf
// ---------------------------------------------------------------------------

export type GroupClassroomAccess =
  | { ok: true; session: GroupSession; course: GroupCourse; role: "teacher" | "student"; opensAt: Date; closesAt: Date }
  | { ok: false; reason: string; opensAt?: Date };

export async function groupClassroomAccess(sessionId: string, userId: string, now = new Date()): Promise<GroupClassroomAccess> {
  const session = await db.groupSession.findUnique({ where: { id: sessionId }, include: { course: true } });
  if (!session) return { ok: false, reason: "Ders bulunamadı." };
  const { course } = session;
  const isTeacher = course.teacherId === userId;
  const enrolled = isTeacher ? null : await db.groupEnrollment.findFirst({ where: { courseId: course.id, studentId: userId, status: "PAID" } });
  if (!isTeacher && !enrolled) return { ok: false, reason: "Bu derse erişim yetkiniz yok." };
  if (course.status !== "CONFIRMED") return { ok: false, reason: course.status === "OPEN" ? "Ders, en az katılımcı sayısına ulaşıp kayıtlar kapanınca açılır." : "Bu ders kapandı." };
  if (session.status !== "SCHEDULED") return { ok: false, reason: "Bu oturum sona erdi." };
  const settings = await loadSettings();
  const opensAt = new Date(session.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
  const closesAt = new Date(session.endAt.getTime() + CLOSE_AFTER_MINUTES * 60_000);
  if (now < opensAt) return { ok: false, reason: "Sanal sınıf henüz açılmadı.", opensAt };
  if (now > closesAt) return { ok: false, reason: "Bu oturumun süresi doldu." };
  return { ok: true, session, course, role: isTeacher ? "teacher" : "student", opensAt, closesAt };
}

export async function recordGroupVisit(sessionId: string, userId: string, now = new Date()) {
  const recent = await db.groupAttendance.findFirst({ where: { sessionId, userId, joinedAt: { gte: new Date(now.getTime() - 5 * 60_000) } } });
  if (!recent) await db.groupAttendance.create({ data: { sessionId, userId, joinedAt: now } });
}

/** LiveKit olayı grup odasına aitse yoklamaya yazar (öğretmen ya da ödemesi yapılmış öğrenci). */
export async function handleGroupRoomEvent(roomName: string, identity: string, event: string, now = new Date()) {
  const session = await db.groupSession.findUnique({ where: { videoRoomName: roomName }, include: { course: { select: { id: true, teacherId: true } } } });
  if (!session) return;
  const allowed = identity === session.course.teacherId || (await db.groupEnrollment.count({ where: { courseId: session.course.id, studentId: identity, status: "PAID" } })) > 0;
  if (!allowed) return;
  if (event === "participant_joined") {
    await db.groupAttendance.create({ data: { sessionId: session.id, userId: identity, joinedAt: now } });
  } else if (event === "participant_left") {
    const open = await db.groupAttendance.findFirst({ where: { sessionId: session.id, userId: identity, leftAt: null }, orderBy: { joinedAt: "desc" } });
    if (open) await db.groupAttendance.update({ where: { id: open.id }, data: { leftAt: now } });
  }
}

// ---------------------------------------------------------------------------
// Zamanlayıcı
// ---------------------------------------------------------------------------

async function confirmOrCancelAtDeadline(course: GroupCourse, now: Date) {
  const paid = await paidCount(course.id);
  if (paid >= course.minParticipants) {
    await db.$transaction(async (tx) => {
      await lockCourse(tx, course.id);
      const marked = await tx.groupCourse.updateMany({ where: { id: course.id, status: "OPEN" }, data: { status: "CONFIRMED", confirmedAt: now } });
      if (marked.count !== 1) return;
      await tx.groupEnrollment.updateMany({ where: { courseId: course.id, status: { in: ["INVITED", "PENDING_PAYMENT"] } }, data: { status: "EXPIRED", holdExpiresAt: null } });
      const students = await tx.groupEnrollment.findMany({ where: { courseId: course.id, status: "PAID" }, select: { id: true, studentId: true } });
      const first = await tx.groupSession.findFirst({ where: { courseId: course.id }, orderBy: { index: "asc" } });
      for (const s of students) {
        await notify({ userId: s.studentId, type: "group.confirmed", lesson: `${course.title} · ${first ? formatDateTime(first.startAt) : ""}`, title: "Grup dersiniz kesinleşti", body: `${course.title} ${paid} kişiyle açılıyor. İlk oturum: ${first ? formatDateTime(first.startAt) : "—"}.`, link: `/hesabim/grup-derslerim/${s.id}` }, tx);
      }
      await notify({ userId: course.teacherId, type: "group.confirmed", lesson: `${course.title} · ${first ? formatDateTime(first.startAt) : ""}`, title: "Grup dersiniz kesinleşti", body: `${course.title} · ${paid} öğrenci. İlk oturum: ${first ? formatDateTime(first.startAt) : "—"}.`, link: `/ogretmen-paneli/grup-dersleri/${course.id}` }, tx);
    });
  } else {
    await cancelGroupCourse(course.id, `kayıt süresinde en az ${course.minParticipants} katılımcıya ulaşılamadı`, null, now).catch((error: unknown) => {
      if (!(error instanceof GroupError)) throw error;
    });
  }
}

/** Oturum bitti: öğretmen katıldıysa tamamlandı (pay itiraz ve aktarım süresi sonrası serbest), katılmadıysa payı iade. */
async function finishSession(session: GroupSession & { course: GroupCourse & { sessions: { index: number }[] } }, now: Date) {
  const settings = await loadSettings();
  const count = session.course.sessions.length;
  const teacherJoined = !videoConfigured() || (await db.groupAttendance.count({ where: { sessionId: session.id, userId: session.course.teacherId } })) > 0;
  const enrollments = await db.groupEnrollment.findMany({ where: { courseId: session.courseId, status: "PAID" } });
  const refundIds: string[] = [];
  await db.$transaction(async (tx) => {
    if (teacherJoined) {
      const lastPaid = enrollments.reduce((t, e) => Math.max(t, e.paidAt?.getTime() ?? 0), 0);
      const releaseAt = settledReleaseAt(new Date(session.endAt.getTime() + settings.disputeWindowHours * HOUR), lastPaid ? new Date(lastPaid) : null, settings.settlementDays);
      await tx.groupSession.updateMany({ where: { id: session.id, status: "SCHEDULED" }, data: { status: "COMPLETED", completedAt: now, earningsReleaseAt: releaseAt } });
      return;
    }
    const marked = await tx.groupSession.updateMany({ where: { id: session.id, status: "SCHEDULED" }, data: { status: "TEACHER_NO_SHOW", completedAt: now, earningsReleasedAt: now } });
    if (marked.count !== 1) return;
    for (const e of enrollments) {
      const refund = Math.min(e.price - e.refundedAmount, sessionShare(e.price, count, session.index));
      const teacherCut = sessionShare(e.teacherAmount, count, session.index);
      await tx.groupEnrollment.update({ where: { id: e.id }, data: { refundedAmount: { increment: refund } } });
      if (teacherCut > 0) await addLedgerEntry(tx, { teacherId: session.course.teacherId, groupEnrollmentId: e.id, bucket: "PENDING", amount: -teacherCut, description: `${e.code} ${session.index + 1}. oturuma öğretmen katılmadı` });
      const id = await createRefund(tx, e.id, refund, `Grup dersi ${session.index + 1}. oturum: öğretmen katılmadı`);
      if (id) refundIds.push(id);
      await notify({ userId: e.studentId, type: "group.no_show_teacher", title: "Öğretmen grup dersine katılmadı", body: `${session.course.title} · ${session.index + 1}. oturum. Bu oturumun ücreti (${formatMoney(refund)}) kartınıza iade ediliyor.`, link: `/hesabim/grup-derslerim/${e.id}` }, tx);
    }
    await notify({ userId: session.course.teacherId, type: "group.no_show_teacher", title: "Grup dersi oturumuna katılmadınız", body: `${session.course.title} · ${session.index + 1}. oturum. Bu oturumun ücreti öğrencilere iade edildi.`, link: `/ogretmen-paneli/grup-dersleri/${session.courseId}` }, tx);
    await notifyRole("ADMIN", { type: "admin.group_no_show", title: "Öğretmen grup dersine katılmadı", body: `${session.course.code} · ${session.index + 1}. oturum`, link: "/yonetim/grup-dersleri", email: false }, tx);
  });
  for (const id of refundIds) await processRefund(id);
}

/** Oturum payı serbest: her ödemeli kayıt için o oturumun öğretmen payı bekleyenden ödenebilir bakiyeye geçer. */
async function releaseSession(session: GroupSession & { course: GroupCourse & { sessions: { index: number }[] } }, now: Date) {
  const count = session.course.sessions.length;
  const enrollments = await db.groupEnrollment.findMany({ where: { courseId: session.courseId, status: "PAID" }, include: { payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, take: 1 } } });
  const pendingRefunds = await db.refund.count({ where: { status: "PENDING", payment: { groupEnrollment: { courseId: session.courseId } } } });
  if (pendingRefunds > 0) return false;
  const provider = getPaymentProvider();
  await db.$transaction(async (tx) => {
    const marked = await tx.groupSession.updateMany({ where: { id: session.id, earningsReleasedAt: null }, data: { earningsReleasedAt: now } });
    if (marked.count !== 1) return;
    let total = 0;
    for (const e of enrollments) {
      const share = sessionShare(e.teacherAmount, count, session.index);
      if (share <= 0) continue;
      const payment = e.payments[0];
      const p = payment && payment.provider in PAYMENT_PROVIDERS ? getProviderById(payment.provider) : provider;
      await addLedgerEntry(tx, { teacherId: session.course.teacherId, groupEnrollmentId: e.id, bucket: "PENDING", amount: -share, description: `${e.code} ${session.index + 1}. oturum serbest bırakıldı` });
      if (p.automaticPayouts) {
        const payout = await tx.payout.create({ data: { teacherId: session.course.teacherId, amount: share, method: "PAYMENT_PROVIDER", reference: e.code } });
        await addLedgerEntry(tx, { teacherId: session.course.teacherId, groupEnrollmentId: e.id, payoutId: payout.id, bucket: "PAID", amount: share, description: `${e.code} ödeme kuruluşu tarafından aktarıldı` });
      } else {
        await addLedgerEntry(tx, { teacherId: session.course.teacherId, groupEnrollmentId: e.id, bucket: "AVAILABLE", amount: share, description: `${e.code} grup dersi ${session.index + 1}. oturum` });
      }
      total += share;
    }
    if (total > 0) await notify({ userId: session.course.teacherId, type: "earning.released", title: "Hakedişiniz serbest kaldı", body: `${session.course.title} · ${session.index + 1}. oturum için ${formatMoney(total)} ödenebilir bakiyenize eklendi.`, link: "/ogretmen-paneli/kazanclar", email: false }, tx);
  });
  return true;
}

/** Ödeme süresi geçen yerler, kayıt bitişi (aç/iptal), biten oturumlar, oturum payları, hatırlatmalar. */
export async function processGroups(now = new Date()): Promise<number> {
  let changed = 0;
  const holds = await db.groupEnrollment.updateMany({ where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } }, data: { status: "EXPIRED", holdExpiresAt: null } });
  changed += holds.count;

  const deadline = await db.groupCourse.findMany({ where: { status: "OPEN", enrollDeadline: { lte: now } }, take: 50 });
  for (const course of deadline) {
    await confirmOrCancelAtDeadline(course, now);
    changed++;
  }

  const include = { course: { include: { sessions: { select: { index: true } } } } } as const;
  const ended = await db.groupSession.findMany({ where: { status: "SCHEDULED", endAt: { lte: now }, course: { status: "CONFIRMED" } }, include, orderBy: { endAt: "asc" }, take: 50 });
  for (const session of ended) {
    await finishSession(session, now);
    changed++;
  }

  const due = await db.groupSession.findMany({ where: { status: "COMPLETED", earningsReleaseAt: { lte: now }, earningsReleasedAt: null }, include, take: 50 });
  for (const session of due) if (await releaseSession(session, now)) changed++;

  // Tüm oturumları biten ders tamamlanır
  const finished = await db.groupCourse.findMany({ where: { status: "CONFIRMED", sessions: { none: { status: "SCHEDULED" } } }, select: { id: true }, take: 50 });
  if (finished.length) {
    const r = await db.groupCourse.updateMany({ where: { id: { in: finished.map((c) => c.id) }, status: "CONFIRMED" }, data: { status: "COMPLETED" } });
    changed += r.count;
  }

  // 1 saat kala hatırlatma
  const soon = await db.groupSession.findMany({ where: { status: "SCHEDULED", reminderSentAt: null, startAt: { gt: now, lte: new Date(now.getTime() + HOUR) }, course: { status: "CONFIRMED" } }, include: { course: true }, take: 50 });
  for (const session of soon) {
    const marked = await db.groupSession.updateMany({ where: { id: session.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (marked.count !== 1) continue;
    const enrollments = await db.groupEnrollment.findMany({ where: { courseId: session.courseId, status: "PAID" }, select: { id: true, studentId: true } });
    const body = `${session.course.title} · ${session.index + 1}. oturum ${formatDateTime(session.startAt)} saatinde. “Derse katıl” düğmesi ders saatinden önce açılır.`;
    for (const e of enrollments) await notify({ userId: e.studentId, type: "group.reminder", lesson: `${session.course.title} · ${formatDateTime(session.startAt)}`, title: "Grup dersiniz yaklaşıyor", body, link: `/hesabim/grup-derslerim/${e.id}` });
    await notify({ userId: session.course.teacherId, type: "group.reminder", lesson: `${session.course.title} · ${formatDateTime(session.startAt)}`, title: "Grup dersiniz yaklaşıyor", body, link: `/ogretmen-paneli/grup-dersleri/${session.courseId}` });
    changed++;
  }
  return changed;
}

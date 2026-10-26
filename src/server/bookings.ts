import { randomInt } from "node:crypto";
import type { Booking, BookingStatus, InPersonPlace, LessonMode, Prisma } from "@/generated/prisma/client";
import {
  addDaysToDateString,
  dateStringToDbDate,
  dbDateToString,
  formatDateTime,
  formatLessonRange,
  toLocalDateString,
  zonedDateTime,
} from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { randomToken } from "./auth/password";
import { generateSlots, isSlotAvailable, type BusyRange, type DayException, type SlotDay } from "./availability";
import { db, type DbTransaction } from "./db";
import { addLedgerEntry, pendingForBooking, resetPendingForBooking } from "./ledger";
import { notify, notifyRole } from "./notifications";
import { getPaymentProvider, getProviderById, PAYMENT_PROVIDERS, processRefund, requestRefund, salesOpen } from "./payments/service";
import { completeCreditCheckout } from "./credits";
import { completeSubscriptionCheckout } from "./subscriptions";
import { completeGroupCheckout, groupBusy } from "./groups";
import { DiscountError, recordPaidOrder, resolveDiscount } from "./discounts";
import { approvalDeadline, INTRO_MINUTES, lessonPrice, settledReleaseAt, splitCommission, splitRetained, studentCancellationRefund } from "./pricing";
import { appUrl } from "./email";
import { loadSettings } from "./settings";
import { videoConfigured } from "./video-config";

export class BookingError extends Error {}

const HOUR = 3_600_000;

/** Saati meşgul eden durumlar (ödeme bekleyen kayıt yalnızca süresi dolmadıysa). */
function blockingWhere(now: Date): Prisma.BookingWhereInput {
  return {
    // Fotoğrafla soru saat tutmaz.
    mode: { not: "QUESTION" },
    OR: [
      { status: { in: ["PENDING_APPROVAL", "CONFIRMED"] } },
      { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
    ],
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newBookingCode(): string {
  let code = "VD-";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Aynı öğretmen için eşzamanlı rezervasyonları sıraya sokar (transaction sonunda bırakılır). */
async function lockTeacher(tx: DbTransaction, teacherId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${teacherId}))`;
}

function isOverlapViolation(error: unknown): boolean {
  const parts = [String((error as Error)?.message ?? ""), JSON.stringify((error as { meta?: unknown })?.meta ?? {})];
  const cause = (error as { cause?: unknown })?.cause;
  if (cause) parts.push(JSON.stringify(cause, Object.getOwnPropertyNames(cause as object)));
  const text = parts.join(" ");
  return text.includes("23P01") || text.includes("Booking_teacher_no_overlap");
}

/** Durum geçişi: yalnızca durum değişmemişse uygulanır ve olay kaydı yazılır. */
async function transition(
  tx: DbTransaction,
  booking: Pick<Booking, "id" | "status">,
  to: BookingStatus,
  data: Prisma.BookingUncheckedUpdateManyInput = {},
  actorId: string | null = null,
  note?: string,
) {
  const updated = await tx.booking.updateMany({ where: { id: booking.id, status: booking.status }, data: { ...data, status: to } });
  if (updated.count !== 1) throw new BookingError("Randevunun durumu değişmiş. Sayfayı yenileyip tekrar deneyin.");
  await tx.bookingEvent.create({ data: { bookingId: booking.id, fromStatus: booking.status, toStatus: to, actorId, note } });
}

function toDayException(row: { date: Date; type: "BLOCKED" | "EXTRA"; startMinute: number | null; endMinute: number | null }): DayException {
  return { date: dbDateToString(row.date), type: row.type, startMinute: row.startMinute, endMinute: row.endMinute };
}

async function loadBusy(tx: DbTransaction | typeof db, teacherId: string, from: Date, to: Date, now: Date): Promise<BusyRange[]> {
  const [rows, groups] = await Promise.all([
    tx.booking.findMany({
      where: { teacherId, startAt: { lt: to }, blockEndAt: { gt: from }, ...blockingWhere(now) },
      select: { startAt: true, blockEndAt: true },
    }),
    // Grup dersi oturumları da öğretmenin takvimini doldurur
    groupBusy(tx, teacherId, from, to),
  ]);
  return [...rows.map((row) => ({ start: row.startAt, end: row.blockEndAt })), ...groups];
}

/** Tam iade cümlesi: paket dersinde para değil ders geri döner. */
function fullRefundText(booking: Pick<Booking, "packageId" | "price">, verb = "kartınıza iade ediliyor") {
  return booking.packageId ? "Ders paketinize geri eklendi." : `Ödediğiniz ${formatMoney(booking.price)} ${verb}.`;
}

export function lessonSummary(booking: Pick<Booking, "subjectName" | "levelName" | "serviceName" | "startAt" | "endAt" | "mode" | "code">) {
  if (booking.mode === "QUESTION") return `${booking.levelName} ${booking.subjectName} · Fotoğrafla soru (${booking.code})`;
  return `${booking.levelName} ${booking.subjectName} · ${booking.serviceName} — ${formatLessonRange(booking.startAt, booking.endAt)}`;
}

// ---------------------------------------------------------------------------
// Boş saatler
// ---------------------------------------------------------------------------

export async function getTeacherSlots(
  teacherId: string,
  options: { durationMinutes: number; startDate?: string; days?: number },
  now = new Date(),
): Promise<SlotDay[]> {
  const settings = await loadSettings();
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    select: { bufferMinutes: true, availabilityRules: true },
  });
  if (!teacher) return [];

  const startDate = options.startDate ?? toLocalDateString(now);
  const days = options.days ?? 7;
  const endDate = addDaysToDateString(startDate, days);
  const [exceptions, busy] = await Promise.all([
    db.availabilityException.findMany({
      where: { teacherId, date: { gte: dateStringToDbDate(startDate), lt: dateStringToDbDate(endDate) } },
    }),
    loadBusy(db, teacherId, zonedDateTime(addDaysToDateString(startDate, -1), 0), zonedDateTime(addDaysToDateString(endDate, 1), 0), now),
  ]);

  return generateSlots({
    rules: teacher.availabilityRules,
    exceptions: exceptions.map(toDayException),
    busy,
    durationMinutes: options.durationMinutes,
    bufferMinutes: teacher.bufferMinutes,
    startDate,
    days,
    now,
    minNoticeHours: settings.minNoticeHours,
    allowSameDay: settings.allowSameDayBooking,
    maxAdvanceDays: settings.maxAdvanceDays,
  });
}

// ---------------------------------------------------------------------------
// Rezervasyon ve ödeme
// ---------------------------------------------------------------------------

export type CreateBookingInput = {
  studentId: string;
  offeringId: string;
  startAt: Date;
  durationMinutes: number;
  mode: LessonMode;
  learnerName: string;
  learnerGrade?: string | null;
  inPersonPlace?: InPersonPlace | null;
  districtId?: number | null;
  address?: string | null;
  studentNote?: string | null;
  /** Ücretsiz 15 dakikalık tanışma görüşmesi: ödeme yok, doğrudan öğretmen onayına düşer. */
  intro?: boolean;
  /** İndirim kodu (boşsa uygunsa davet indirimi) */
  couponCode?: string | null;
  /** Paketten alınan ders: ödeme yok, ders paketten düşer ve doğrudan öğretmen onayına gider */
  packageId?: string | null;
};

/** Bir öğrencinin aynı anda bekleyen/onaylı en fazla tanışma görüşmesi. */
const MAX_OPEN_INTROS = 2;

/**
 * Saati ödeme süresi boyunca kilitleyen randevu kaydı oluşturur (PENDING_PAYMENT).
 * Tanışma görüşmesinde ödeme yoktur: kayıt doğrudan öğretmen onayına (PENDING_APPROVAL) düşer.
 */
export async function createBookingHold(input: CreateBookingInput, now = new Date(), options: { ignoreMaxAdvance?: boolean } = {}): Promise<Booking> {
  const intro = Boolean(input.intro);
  const pkg = input.packageId && !intro ? await db.lessonPackage.findUnique({ where: { id: input.packageId } }) : null;
  if (input.packageId && !intro) {
    if (!pkg || pkg.studentId !== input.studentId || pkg.status !== "PAID") throw new BookingError("Paket bulunamadı ya da kullanılamıyor.");
    if (pkg.expiresAt && pkg.expiresAt <= now) throw new BookingError("Paketinizin kullanım süresi doldu.");
    if (pkg.offeringId !== input.offeringId || pkg.durationMinutes !== input.durationMinutes) throw new BookingError("Bu paket yalnızca aynı ders ve sürede kullanılabilir.");
  }
  if (!intro && !pkg && !salesOpen()) throw new BookingError("Online ödeme altyapımız çok yakında açılıyor; şu an ders ve soru satışı yapılamıyor.");
  const settings = await loadSettings();
  const offering = await db.teacherOffering.findUnique({
    where: { id: input.offeringId },
    include: {
      level: true,
      subject: true,
      serviceType: true,
      teacher: { include: { user: true, availabilityRules: true, serviceDistricts: true } },
    },
  });
  if (!offering || !offering.isActive) throw new BookingError("Bu ders artık sunulmuyor.");
  const teacher = offering.teacher;
  if (teacher.status !== "PUBLISHED" || teacher.user.status !== "ACTIVE") {
    throw new BookingError("Bu öğretmen şu an randevu kabul etmiyor.");
  }
  if (teacher.userId === input.studentId) throw new BookingError("Kendi profilinizden randevu alamazsınız.");
  if (intro) {
    if (!teacher.offersIntro) throw new BookingError("Bu öğretmen ücretsiz tanışma görüşmesi sunmuyor.");
    if (input.durationMinutes !== INTRO_MINUTES || input.mode !== "ONLINE") throw new BookingError("Tanışma görüşmesi 15 dakika ve online yapılır.");
    const previous = await db.booking.count({
      where: { studentId: input.studentId, teacherId: teacher.userId, isIntro: true, status: { in: ["PENDING_APPROVAL", "CONFIRMED", "COMPLETED", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER"] } },
    });
    if (previous) throw new BookingError("Bu öğretmenle tanışma görüşmesini zaten aldınız; ders almak için süre ve saat seçin.");
    const open = await db.booking.count({ where: { studentId: input.studentId, isIntro: true, status: { in: ["PENDING_APPROVAL", "CONFIRMED"] } } });
    if (open >= MAX_OPEN_INTROS) throw new BookingError(`Aynı anda en fazla ${MAX_OPEN_INTROS} tanışma görüşmesi bekleyebilir; önce onları tamamlayın.`);
  } else if (!offering.durations.includes(input.durationMinutes)) {
    throw new BookingError("Seçtiğiniz ders süresi sunulmuyor.");
  }

  const learnerName = input.learnerName.trim();
  if (!learnerName) throw new BookingError("Dersin kimin için olduğunu yazın.");

  let district: { id: number; cityId: number } | null = null;
  if (input.mode === "ONLINE") {
    if (!teacher.offersOnline) throw new BookingError("Bu öğretmen online ders vermiyor.");
  } else {
    if (!teacher.offersInPerson) throw new BookingError("Bu öğretmen yüz yüze ders vermiyor.");
    if (input.inPersonPlace === "STUDENT_HOME") {
      if (!teacher.inPersonAtStudentHome) throw new BookingError("Öğretmen öğrencinin adresine gitmiyor.");
      if (!input.districtId || !input.address?.trim()) throw new BookingError("Yüz yüze ders için ilçe ve adres gerekli.");
      district = await db.district.findUnique({ where: { id: input.districtId }, select: { id: true, cityId: true } });
      const served = teacher.serviceDistricts.length
        ? teacher.serviceDistricts.some((d) => d.districtId === input.districtId)
        : district?.cityId === teacher.cityId;
      if (!district || !served) throw new BookingError("Öğretmen seçtiğiniz ilçede yüz yüze ders vermiyor.");
    } else if (input.inPersonPlace === "TEACHER_PLACE") {
      if (!teacher.inPersonAtTeacherPlace) throw new BookingError("Öğretmen kendi yerinde ders vermiyor.");
    } else {
      throw new BookingError("Yüz yüze dersin nerede yapılacağını seçin.");
    }
  }

  const provider = getPaymentProvider();
  if (!intro && provider.requiresSubMerchant && !teacher.subMerchantKey) {
    throw new BookingError("Öğretmenin ödeme hesabı henüz tamamlanmadığı için şu an randevu alınamıyor.");
  }

  // Paket dersi: paketteki ders başı ücret ve paketin komisyon oranı
  const listPrice = intro ? 0 : pkg ? pkg.unitPrice : lessonPrice(offering.hourlyPrice, input.durationMinutes);
  const commissionRateBps = pkg ? pkg.commissionRateBps : (teacher.commissionRateBps ?? settings.commissionRateBps);
  const split = splitCommission(listPrice, commissionRateBps);
  // İndirim platformun hizmet bedelinden düşer; öğretmen payı değişmez.
  const discount = intro || pkg
    ? { amount: 0, couponCode: null }
    : await resolveDiscount(input.studentId, input.couponCode, "booking", listPrice, split.commissionAmount, now).catch((error: unknown) => {
        if (error instanceof DiscountError) throw new BookingError(error.message);
        throw error;
      });
  const price = listPrice - discount.amount;
  const commissionAmount = split.commissionAmount - discount.amount;
  const teacherAmount = split.teacherAmount;
  const endAt = new Date(input.startAt.getTime() + input.durationMinutes * 60_000);
  const blockEndAt = endAt;

  try {
    return await db.$transaction(async (tx) => {
      await lockTeacher(tx, teacher.userId);
      await expireStaleHoldsForTeacher(tx, teacher.userId, now);
      if (pkg) {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`pkg:${pkg.id}`}))`;
        if ((await packageLessonsLeft(tx, pkg)) <= 0) throw new BookingError("Paketinizde kullanılmamış ders kalmadı.");
      }

      const date = toLocalDateString(input.startAt);
      const [exceptions, busy] = await Promise.all([
        tx.availabilityException.findMany({ where: { teacherId: teacher.userId, date: dateStringToDbDate(date) } }),
        loadBusy(tx, teacher.userId, new Date(input.startAt.getTime() - 24 * HOUR), new Date(blockEndAt.getTime() + 24 * HOUR), now),
      ]);
      const available = isSlotAvailable(
        {
          rules: teacher.availabilityRules,
          exceptions: exceptions.map(toDayException),
          busy,
          durationMinutes: input.durationMinutes,
          bufferMinutes: teacher.bufferMinutes,
          now,
          minNoticeHours: settings.minNoticeHours,
          allowSameDay: settings.allowSameDayBooking,
          maxAdvanceDays: options.ignoreMaxAdvance ? 366 : settings.maxAdvanceDays,
        },
        input.startAt,
      );
      if (!available) throw new BookingError("Seçtiğiniz saat artık müsait değil. Lütfen başka bir saat seçin.");

      const studentClash = await tx.booking.findFirst({
        where: { studentId: input.studentId, startAt: { lt: endAt }, endAt: { gt: input.startAt }, ...blockingWhere(now) },
        select: { id: true },
      });
      if (studentClash) throw new BookingError("Bu saatte başka bir dersiniz var.");

      const learner = await tx.learner.upsert({
        where: { studentId_name: { studentId: input.studentId, name: learnerName } },
        create: { studentId: input.studentId, name: learnerName, gradeName: input.learnerGrade || null },
        update: input.learnerGrade ? { gradeName: input.learnerGrade } : {},
      });

      const booking = await tx.booking.create({
        data: {
          code: newBookingCode(),
          studentId: input.studentId,
          teacherId: teacher.userId,
          offeringId: offering.id,
          learnerId: learner.id,
          serviceTypeId: offering.serviceTypeId,
          levelId: offering.levelId,
          subjectId: offering.subjectId,
          serviceName: intro ? "Ücretsiz tanışma" : offering.serviceType.name,
          levelName: offering.level.name,
          subjectName: offering.subject.name,
          learnerName,
          learnerGrade: input.learnerGrade || null,
          mode: input.mode,
          inPersonPlace: input.mode === "IN_PERSON" ? input.inPersonPlace : null,
          cityId: input.mode === "IN_PERSON" ? (district?.cityId ?? teacher.cityId) : null,
          districtId: input.mode === "IN_PERSON" ? (district?.id ?? teacher.districtId) : null,
          address: input.mode === "IN_PERSON" && input.inPersonPlace === "STUDENT_HOME" ? input.address?.trim() : null,
          studentNote: input.studentNote?.trim() || null,
          startAt: input.startAt,
          endAt,
          blockEndAt,
          durationMinutes: input.durationMinutes,
          price,
          commissionRateBps,
          commissionAmount,
          teacherAmount,
          discountAmount: discount.amount,
          couponCode: discount.couponCode,
          packageId: pkg?.id ?? null,
          // Paket dersinin ödemesi paketin ödemesidir (hakediş aktarım süresi ondan sayılır)
          paidAt: pkg?.paidAt ?? null,
          status: intro || pkg ? "PENDING_APPROVAL" : "PENDING_PAYMENT",
          isIntro: intro,
          holdExpiresAt: intro || pkg ? null : new Date(now.getTime() + settings.paymentHoldMinutes * 60_000),
          approvalDeadline: intro || pkg ? approvalDeadline(now, input.startAt, settings) : null,
        },
      });
      await tx.bookingEvent.create({
        data: { bookingId: booking.id, toStatus: booking.status, actorId: input.studentId, note: intro ? "Ücretsiz tanışma görüşmesi istendi" : pkg ? `Paketten (${pkg.code}) ders talebi` : "Saat ödeme için ayrıldı" },
      });
      if (pkg) {
        await notify(
          {
            userId: teacher.userId,
            type: "booking.request",
            lesson: lessonSummary(booking),
            title: "Yeni ders talebi (paket)",
            body: `${learnerName} için ${lessonSummary(booking)}. Ücret ödenmiş paketten. Lütfen ${formatDateTime(booking.approvalDeadline!)} saatine kadar onaylayın.`,
            link: "/ogretmen-paneli/talepler",
          },
          tx,
        );
      }
      if (intro) {
        await notify(
          {
            userId: teacher.userId,
            type: "booking.request",
            lesson: lessonSummary(booking),
            title: "Ücretsiz tanışma görüşmesi talebi",
            body: `${learnerName} için ${lessonSummary(booking)}. Lütfen ${formatDateTime(booking.approvalDeadline!)} saatine kadar onaylayın.`,
            link: "/ogretmen-paneli/talepler",
          },
          tx,
        );
      }
      return booking;
    });
  } catch (error) {
    if (isOverlapViolation(error)) throw new BookingError("Seçtiğiniz saat az önce doldu. Lütfen başka bir saat seçin.");
    throw error;
  }
}

/**
 * Erteleme: dersin yeni saati öğretmenin takviminde uygun mu? Dersin kendi eski saati dolu sayılmaz.
 * Transaction içinde, öğretmen kilidi alınmış olarak çağrılmalı.
 */
export async function rescheduleSlotFree(tx: DbTransaction, booking: Booking, newStartAt: Date, now = new Date()) {
  const settings = await loadSettings();
  const teacher = await tx.teacherProfile.findUniqueOrThrow({ where: { userId: booking.teacherId }, select: { bufferMinutes: true, availabilityRules: true } });
  const date = toLocalDateString(newStartAt);
  const end = new Date(newStartAt.getTime() + booking.durationMinutes * 60_000);
  const [exceptions, busy] = await Promise.all([
    tx.availabilityException.findMany({ where: { teacherId: booking.teacherId, date: dateStringToDbDate(date) } }),
    loadBusy(tx, booking.teacherId, new Date(newStartAt.getTime() - 24 * HOUR), new Date(end.getTime() + 24 * HOUR), now),
  ]);
  const others = busy.filter((b) => !(b.start.getTime() === booking.startAt.getTime() && b.end.getTime() === booking.blockEndAt.getTime()));
  return isSlotAvailable(
    {
      rules: teacher.availabilityRules,
      exceptions: exceptions.map(toDayException),
      busy: others,
      durationMinutes: booking.durationMinutes,
      bufferMinutes: teacher.bufferMinutes,
      now,
      minNoticeHours: settings.minNoticeHours,
      allowSameDay: settings.allowSameDayBooking,
      maxAdvanceDays: settings.maxAdvanceDays,
    },
    newStartAt,
  );
}

export { lockTeacher };

/** Paketteki kullanılmamış ders sayısı: tam iade edilen (öğretmen reddi, süre aşımı, erken iptal…) dersler pakete geri döner. */
export async function packageLessonsLeft(tx: DbTransaction | typeof db, pkg: { id: string; lessonCount: number }) {
  const used = await tx.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "Booking" WHERE "packageId" = ${pkg.id} AND "refundedAmount" < "price"`;
  return pkg.lessonCount - Number(used[0]?.n ?? 0);
}

async function expireStaleHoldsForTeacher(tx: DbTransaction, teacherId: string, now: Date) {
  const stale = await tx.booking.findMany({
    where: { teacherId, status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
    select: { id: true, status: true },
  });
  for (const booking of stale) {
    await transition(tx, booking, "EXPIRED", {}, null, "Ödeme süresi doldu");
  }
}

/** Ödeme sayfasını başlatır ve yönlendirme adresini döndürür. */
export async function startCheckout(bookingId: string, studentId: string, ipAddress: string, now = new Date()): Promise<string> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { student: { include: { studentProfile: { include: { city: true } } } }, teacher: true },
  });
  if (!booking || booking.studentId !== studentId) throw new BookingError("Randevu bulunamadı.");
  if (booking.status !== "PENDING_PAYMENT") throw new BookingError("Bu randevu için ödeme beklenmiyor.");
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= now) {
    throw new BookingError("Ödeme süresi doldu. Lütfen saati yeniden seçin.");
  }
  if (!booking.student.email) throw new BookingError("Ödeme için hesabınızda e-posta adresi olmalı.");

  const provider = getPaymentProvider();
  const payment = await db.payment.create({ data: { bookingId, provider: provider.id, amount: booking.price } });
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: booking.id,
      bookingCode: booking.code,
      amount: booking.price,
      description: `${booking.levelName} ${booking.subjectName} - ${booking.serviceName} (${booking.durationMinutes} dk)`,
      buyer: {
        id: booking.studentId,
        firstName: booking.student.firstName,
        lastName: booking.student.lastName,
        email: booking.student.email,
        phone: booking.student.phone,
        ipAddress,
        city: booking.student.studentProfile?.city?.name ?? null,
        registeredAt: booking.student.createdAt,
      },
      teacher: { subMerchantKey: booking.teacher.subMerchantKey, amount: booking.teacherAmount },
      callbackUrl: appUrl(`/api/odeme/${provider.id}/donus`),
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerToken: session.token } });
    return session.redirectUrl;
  } catch (error) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: String(error).slice(0, 300) },
    });
    throw new BookingError("Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar deneyin.");
  }
}

export type CheckoutOutcome = "paid" | "failed" | "refunded" | "already" | "pending";

/**
 * Ödeme kuruluşundan dönüşte (veya test ödeme sayfasından) ödemeyi sonuçlandırır. Tekrar çağrılabilir.
 * Dönen bookingId sonuç sayfasının kimliğidir: kredi paketi ve abonelik ödemesinde onların kimliği.
 */
export async function completeCheckout(token: string, now = new Date()): Promise<{ bookingId: string; outcome: CheckoutOutcome }> {
  const found = await db.payment.findUnique({ where: { providerToken: token } });
  if (!found) throw new BookingError("Ödeme kaydı bulunamadı.");
  if (found.creditPurchaseId) {
    return { bookingId: found.creditPurchaseId, outcome: await completeCreditCheckout(found, now) };
  }
  if (found.subscriptionId) {
    return { bookingId: found.subscriptionId, outcome: await completeSubscriptionCheckout(found, now) };
  }
  if (found.groupEnrollmentId) {
    return { bookingId: found.groupEnrollmentId, outcome: await completeGroupCheckout(found, now) };
  }
  if (found.packageId) {
    // Paket modülü randevu modülünü kullandığı için burada geç yüklenir (döngüsel içe aktarma olmasın)
    const { completePackageCheckout } = await import("./packages");
    return { bookingId: found.packageId, outcome: await completePackageCheckout(found, now) };
  }
  if (!found.bookingId) throw new BookingError("Ödeme kaydı bulunamadı.");
  const payment = { ...found, bookingId: found.bookingId };
  if (payment.status !== "INITIATED") return { bookingId: payment.bookingId, outcome: "already" };

  const result = await getProviderById(payment.provider).retrieveResult(token);
  if (result.status === "pending") return { bookingId: payment.bookingId, outcome: "pending" };
  const raw = (result.raw ?? undefined) as Prisma.InputJsonValue | undefined;

  if (result.status === "failure") {
    await db.payment.updateMany({
      where: { id: payment.id, status: "INITIATED" },
      data: { status: "FAILED", failureReason: result.reason.slice(0, 300), raw },
    });
    return { bookingId: payment.bookingId, outcome: "failed" };
  }

  const settings = await loadSettings();
  let refundId: string | null = null;

  const outcome = await db.$transaction(async (tx): Promise<CheckoutOutcome> => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: "INITIATED" },
      data: { status: "SUCCEEDED", providerPaymentId: result.providerPaymentId, providerItemId: result.providerItemId, raw },
    });
    if (updated.count === 0) return "already";

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    await lockTeacher(tx, booking.teacherId);

    const recoverable = ["PENDING_PAYMENT", "EXPIRED", "PAYMENT_FAILED"].includes(booking.status);
    let canProceed = recoverable && result.paidAmount === payment.amount;
    const holdLapsed = booking.status !== "PENDING_PAYMENT" || !booking.holdExpiresAt || booking.holdExpiresAt <= now;
    if (canProceed && holdLapsed) {
      const clash = await tx.booking.findFirst({
        where: {
          teacherId: booking.teacherId,
          id: { not: booking.id },
          startAt: { lt: booking.blockEndAt },
          blockEndAt: { gt: booking.startAt },
          ...blockingWhere(now),
        },
        select: { id: true },
      });
      canProceed = booking.mode === "QUESTION" || (!clash && booking.startAt.getTime() > now.getTime());
    }

    if (!canProceed) {
      // Randevu başka bir ödemeyle zaten ödenmişse bu ödeme mükerrerdir: tamamı iade edilir, randevu etkilenmez.
      const duplicate = !recoverable && booking.paidAt !== null;
      if (booking.status === "PENDING_PAYMENT") {
        await transition(tx, booking, "EXPIRED", {}, null, "Ödeme geç tamamlandı; saat dolduğu için ücret iade edildi");
      }
      refundId = await requestRefund(tx, booking.id, payment.amount, duplicate ? "Mükerrer ödeme iadesi" : "Saat dolduğu için otomatik iade", {
        paymentId: payment.id,
        countTowardBooking: !duplicate,
      });
      await notify(
        {
          userId: booking.studentId,
          type: "payment.refunded",
          title: "Ödemeniz iade ediliyor",
          body: duplicate
            ? `${booking.code} numaralı randevu için ikinci bir ödeme alındı. Fazladan çekilen ${formatMoney(payment.amount)} kartınıza iade ediliyor.`
            : `${booking.code} numaralı randevunun saati ödeme tamamlanmadan doldu. ${formatMoney(payment.amount)} kartınıza iade ediliyor.`,
          link: `/hesabim/derslerim/${booking.id}`,
        },
        tx,
      );
      return "refunded";
    }

    const isQuestion = booking.mode === "QUESTION";
    const deadline = isQuestion ? new Date(now.getTime() + settings.questionAnswerHours * HOUR) : approvalDeadline(now, booking.startAt, settings);
    await transition(
      tx,
      booking,
      "PENDING_APPROVAL",
      { paidAt: now, approvalDeadline: deadline, holdExpiresAt: null },
      booking.studentId,
      "Ödeme alındı",
    );
    await recordPaidOrder(tx, { userId: booking.studentId, targetType: "booking", targetId: booking.id, discountAmount: booking.discountAmount, couponCode: booking.couponCode });
    await notify(
      {
        userId: booking.teacherId,
        type: "booking.request",
        lesson: lessonSummary(booking),
        title: isQuestion ? "Yeni soru geldi" : "Yeni ders talebi",
        body: isQuestion
          ? `${booking.learnerName} · ${lessonSummary(booking)}. Çözümü ${formatDateTime(deadline)} saatine kadar gönderin; gönderilmezse ücret öğrenciye iade edilir.`
          : `${booking.learnerName} için ${lessonSummary(booking)}. Lütfen ${formatDateTime(deadline)} saatine kadar onaylayın; yanıt verilmezse talep iptal edilir.`,
        link: isQuestion ? `/ogretmen-paneli/dersler/${booking.id}` : "/ogretmen-paneli/talepler",
      },
      tx,
    );
    await notify(
      {
        userId: booking.studentId,
        type: "booking.paid",
        title: isQuestion ? "Sorunuz öğretmene iletildi" : "Ödemeniz alındı, öğretmen onayı bekleniyor",
        body: isQuestion
          ? `${lessonSummary(booking)}. Çözüm en geç ${formatDateTime(deadline)} saatine kadar gelecek; gelmezse ödediğiniz ${formatMoney(booking.price)} tamamen iade edilir.`
          : `${lessonSummary(booking)}. Öğretmen onaylayınca size haber vereceğiz. Onaylanmazsa ödediğiniz ${formatMoney(booking.price)} tamamen iade edilir.`,
        link: `/hesabim/derslerim/${booking.id}`,
      },
      tx,
    );
    return "paid";
  });

  if (refundId) await processRefund(refundId);
  return { bookingId: payment.bookingId, outcome };
}

// ---------------------------------------------------------------------------
// Test dersi (görüntülü görüşme denemesi)
// ---------------------------------------------------------------------------

/**
 * Yöneticinin ödemesiz açtığı deneme dersi: hemen onaylı, online, ücretsiz.
 * Yorum, puan, hakediş ve istatistiklere sayılmaz.
 */
export async function createTestLesson(input: { teacherId: string; studentId: string; startAt: Date; durationMinutes: number; adminId: string }) {
  const [teacher, student] = await Promise.all([
    db.teacherProfile.findUnique({ where: { userId: input.teacherId }, include: { user: true, offerings: { take: 1, include: { level: true, subject: true, serviceType: true } } } }),
    db.user.findUnique({ where: { id: input.studentId }, include: { studentProfile: true } }),
  ]);
  if (!teacher || teacher.user.status !== "ACTIVE") throw new BookingError("Öğretmen bulunamadı veya hesabı kapalı.");
  if (!student || student.role !== "STUDENT" || !student.studentProfile) throw new BookingError("Öğrenci/veli hesabı bulunamadı.");
  if (![45, 60].includes(input.durationMinutes)) throw new BookingError("Geçersiz süre.");

  const offering = teacher.offerings[0];
  const [level, subject, service] = offering
    ? [offering.level, offering.subject, offering.serviceType]
    : await Promise.all([db.level.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }), db.subject.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }), db.serviceType.findFirstOrThrow({ orderBy: { sortOrder: "asc" } })]);
  const endAt = new Date(input.startAt.getTime() + input.durationMinutes * 60_000);
  const code = `TEST-${newBookingCode().slice(3)}`;

  try {
    return await db.$transaction(async (tx) => {
      await lockTeacher(tx, teacher.userId);
      const booking = await tx.booking.create({
        data: {
          code,
          studentId: student.id,
          teacherId: teacher.userId,
          offeringId: offering?.id ?? null,
          serviceTypeId: service.id,
          levelId: level.id,
          subjectId: subject.id,
          serviceName: "Deneme dersi (test)",
          levelName: level.name,
          subjectName: subject.name,
          learnerName: student.firstName,
          mode: "ONLINE",
          startAt: input.startAt,
          endAt,
          blockEndAt: endAt,
          durationMinutes: input.durationMinutes,
          price: 0,
          commissionRateBps: 0,
          commissionAmount: 0,
          teacherAmount: 0,
          status: "CONFIRMED",
          confirmedAt: new Date(),
          respondedAt: new Date(),
          videoRoomName: `vd-test-${randomToken(9).toLowerCase()}`,
          isTest: true,
        },
      });
      await tx.bookingEvent.create({ data: { bookingId: booking.id, toStatus: "CONFIRMED", actorId: input.adminId, note: "Yönetici test dersi oluşturdu (ödemesiz)" } });
      const body = `${formatLessonRange(booking.startAt, booking.endAt)}. Görüntülü görüşme ve beyaz tahta denemesi için ders sınıfı, ders saatinden 10 dakika önce açılır.`;
      await notify({ userId: student.id, type: "booking.test", title: "Deneme dersi oluşturuldu", body, link: `/hesabim/derslerim/${booking.id}` }, tx);
      await notify({ userId: teacher.userId, type: "booking.test", title: "Deneme dersi oluşturuldu", body: `${student.firstName} ile. ${body}`, link: `/ogretmen-paneli/dersler/${booking.id}` }, tx);
      return booking;
    });
  } catch (error) {
    if (isOverlapViolation(error)) throw new BookingError("Öğretmenin bu saatte başka bir dersi var.");
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Öğretmen kararları
// ---------------------------------------------------------------------------

async function recordResponseTime(tx: DbTransaction, booking: Booking, now: Date) {
  if (!booking.paidAt) return;
  const minutes = Math.max(0, Math.round((now.getTime() - booking.paidAt.getTime()) / 60_000));
  const teacher = await tx.teacherProfile.findUniqueOrThrow({
    where: { userId: booking.teacherId },
    select: { avgResponseMinutes: true, responseCount: true },
  });
  const average = Math.round(((teacher.avgResponseMinutes ?? 0) * teacher.responseCount + minutes) / (teacher.responseCount + 1));
  await tx.teacherProfile.update({
    where: { userId: booking.teacherId },
    data: { avgResponseMinutes: average, responseCount: { increment: 1 } },
  });
}

export async function approveBooking(bookingId: string, teacherId: string, now = new Date()) {
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.teacherId !== teacherId) throw new BookingError("Talep bulunamadı.");
    if (booking.status !== "PENDING_APPROVAL") throw new BookingError("Bu talep artık onay beklemiyor.");
    if (booking.mode === "QUESTION") throw new BookingError("Fotoğrafla soruda onay yerine çözümü gönderin.");
    if (booking.approvalDeadline && booking.approvalDeadline <= now) {
      throw new BookingError("Onay süresi doldu; talep otomatik olarak iptal edilecek.");
    }

    const videoRoomName = booking.mode === "ONLINE" ? `vd-${booking.code.toLowerCase()}-${randomToken(6)}` : null;
    await transition(tx, booking, "CONFIRMED", { confirmedAt: now, respondedAt: now, videoRoomName }, teacherId, "Öğretmen onayladı");
    await addLedgerEntry(tx, {
      teacherId,
      bookingId,
      bucket: "PENDING",
      amount: booking.teacherAmount,
      description: `${booking.code} ders ücreti (ders sonrası serbest kalır)`,
    });
    await recordResponseTime(tx, booking, now);

    const where =
      booking.mode === "ONLINE"
        ? "Ders sitemizdeki sanal sınıfta yapılacak; ders saatinden 10 dakika önce “Derse Katıl” butonu açılır."
        : "Yüz yüze ders. Adres ve ayrıntılar ders sayfasında.";
    await notify(
      {
        userId: booking.studentId,
        type: "booking.confirmed",
        lesson: lessonSummary(booking),
        title: "Dersiniz onaylandı",
        body: `${lessonSummary(booking)}. ${where}`,
        link: `/hesabim/derslerim/${booking.id}`,
      },
      tx,
    );
  });
}

export async function rejectBooking(bookingId: string, teacherId: string, reason: string, now = new Date()) {
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.teacherId !== teacherId) throw new BookingError("Talep bulunamadı.");
    if (booking.status !== "PENDING_APPROVAL") throw new BookingError("Bu talep artık onay beklemiyor.");

    await transition(tx, booking, "REJECTED", { respondedAt: now, rejectionReason: reason }, teacherId, reason);
    await recordResponseTime(tx, booking, now);
    refundId = await requestRefund(tx, booking.id, booking.price, "Öğretmen talebi reddetti");
    await notify(
      {
        userId: booking.studentId,
        type: "booking.rejected",
        lesson: lessonSummary(booking),
        title: "Ders talebiniz onaylanmadı",
        body: `${lessonSummary(booking)}. Öğretmenin notu: “${reason}”. ${fullRefundText(booking)}`,
        link: "/ogretmenler",
      },
      tx,
    );
  });
  if (refundId) await processRefund(refundId);
}

// ---------------------------------------------------------------------------
// İptaller
// ---------------------------------------------------------------------------

export type CancellationPreview = { refundAmount: number; refundPercent: number; allowed: boolean; reason?: string };

/** Öğrencinin iptal etmesi durumunda ne kadar iade alacağını gösterir. */
export async function previewStudentCancellation(booking: Booking, now = new Date()): Promise<CancellationPreview> {
  if (booking.status === "PENDING_PAYMENT") return { allowed: true, refundAmount: 0, refundPercent: 0 };
  if (booking.status === "PENDING_APPROVAL") return { allowed: true, refundAmount: booking.price, refundPercent: 100 };
  if (booking.status !== "CONFIRMED") return { allowed: false, refundAmount: 0, refundPercent: 0, reason: "Bu randevu iptal edilemez." };
  if (booking.startAt <= now) {
    return { allowed: false, refundAmount: 0, refundPercent: 0, reason: "Başlamış bir ders iptal edilemez; sorun yaşadıysanız ders bitince bildirebilirsiniz." };
  }
  const settings = await loadSettings();
  return { allowed: true, ...studentCancellationRefund(booking.price, booking.startAt, now, settings) };
}

export async function cancelByStudent(bookingId: string, studentId: string, reason: string, now = new Date()) {
  const settings = await loadSettings();
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.studentId !== studentId) throw new BookingError("Randevu bulunamadı.");
    const preview = await previewStudentCancellation(booking, now);
    if (!preview.allowed) throw new BookingError(preview.reason ?? "Bu randevu iptal edilemez.");

    if (booking.status === "PENDING_PAYMENT") {
      await transition(tx, booking, "CANCELLED_BY_STUDENT", { cancelledAt: now, cancelReason: reason, holdExpiresAt: null }, studentId, reason);
      return;
    }

    const retained = splitRetained(booking.price, booking.commissionAmount, booking.refundedAmount + preview.refundAmount);
    const teacherShare = booking.status === "CONFIRMED" ? retained.teacher : 0;
    await transition(
      tx,
      booking,
      "CANCELLED_BY_STUDENT",
      {
        cancelledAt: now,
        cancelReason: reason,
        earningsReleaseAt: teacherShare > 0 ? new Date(booking.endAt.getTime() + settings.disputeWindowHours * HOUR) : null,
      },
      studentId,
      reason,
    );
    refundId = await requestRefund(tx, booking.id, preview.refundAmount, `Öğrenci iptali (%${preview.refundPercent} iade)`);
    if (booking.status === "CONFIRMED") {
      await resetPendingForBooking(tx, booking, teacherShare, `${booking.code} öğrenci iptali sonrası hakediş`);
    }

    const refundText = booking.packageId && preview.refundAmount >= booking.price ? "Ders paketinize geri eklendi." : preview.refundAmount > 0 ? `${formatMoney(preview.refundAmount)} iade ediliyor.` : "İptal politikası gereği iade yapılmadı.";
    await notify(
      { userId: booking.studentId, type: "booking.cancelled", lesson: lessonSummary(booking), title: "Randevunuz iptal edildi", body: `${lessonSummary(booking)}. ${refundText}`, link: `/hesabim/derslerim/${booking.id}` },
      tx,
    );
    await notify(
      {
        userId: booking.teacherId,
        type: "booking.cancelled",
        lesson: lessonSummary(booking),
        title: "Öğrenci dersi iptal etti",
        body: `${booking.learnerName} — ${lessonSummary(booking)}. Gerekçe: “${reason}”.${teacherShare > 0 ? ` Geç iptal nedeniyle ${formatMoney(teacherShare)} hakedişiniz korunuyor.` : ""}`,
        link: "/ogretmen-paneli/dersler",
      },
      tx,
    );
  });
  if (refundId) await processRefund(refundId);
}

export async function cancelByTeacher(bookingId: string, teacherId: string, reason: string, now = new Date()) {
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.teacherId !== teacherId) throw new BookingError("Ders bulunamadı.");
    if (booking.status !== "CONFIRMED") throw new BookingError("Yalnızca onaylanmış dersler iptal edilebilir.");
    if (booking.startAt <= now) throw new BookingError("Başlamış bir ders iptal edilemez.");

    await transition(tx, booking, "CANCELLED_BY_TEACHER", { cancelledAt: now, cancelReason: reason }, teacherId, reason);
    refundId = await requestRefund(tx, booking.id, booking.price - booking.refundedAmount, "Öğretmen iptali");
    await resetPendingForBooking(tx, booking, 0, `${booking.code} öğretmen iptali`);
    await tx.teacherProfile.update({ where: { userId: teacherId }, data: { cancellationCount: { increment: 1 } } });

    await notify(
      {
        userId: booking.studentId,
        type: "booking.cancelled",
        lesson: lessonSummary(booking),
        title: "Öğretmeniniz dersi iptal etti",
        body: `${lessonSummary(booking)}. Öğretmenin notu: “${reason}”. ${fullRefundText(booking, "tamamen iade ediliyor")}`,
        link: "/ogretmenler",
      },
      tx,
    );
    await notifyRole(
      "ADMIN",
      { type: "admin.teacher_cancelled", title: "Öğretmen ders iptal etti", body: `${booking.code}: ${reason}`, link: `/yonetim/randevular/${booking.id}`, email: false },
      tx,
    );
  });
  if (refundId) await processRefund(refundId);
}

const ADMIN_CANCELLABLE: BookingStatus[] = ["PENDING_PAYMENT", "PENDING_APPROVAL", "CONFIRMED", "DISPUTED", "COMPLETED", "NO_SHOW_STUDENT"];

/** Admin iptali: iade tutarını admin belirler (onaylanmamış randevularda her zaman tam iade). */
export async function cancelByAdmin(bookingId: string, adminId: string, requestedRefund: number, reason: string, now = new Date()) {
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new BookingError("Randevu bulunamadı.");
    if (!ADMIN_CANCELLABLE.includes(booking.status) || booking.earningsReleasedAt) {
      throw new BookingError("Bu randevu artık iptal edilemez (hakediş ödenmiş olabilir).");
    }
    const remaining = booking.price - booking.refundedAmount;
    const confirmedBefore = !["PENDING_PAYMENT", "PENDING_APPROVAL"].includes(booking.status);
    const paid = booking.status !== "PENDING_PAYMENT";
    const refund = !paid ? 0 : confirmedBefore ? Math.min(Math.max(0, requestedRefund), remaining) : remaining;
    const retained = splitRetained(booking.price, booking.commissionAmount, booking.refundedAmount + refund);
    const teacherShare = confirmedBefore ? retained.teacher : 0;

    await transition(
      tx,
      booking,
      "CANCELLED_BY_ADMIN",
      { cancelledAt: now, cancelReason: reason, holdExpiresAt: null, earningsReleaseAt: teacherShare > 0 ? now : null },
      adminId,
      reason,
    );
    refundId = await requestRefund(tx, booking.id, refund, `Yönetici iptali: ${reason}`);
    if (confirmedBefore) await resetPendingForBooking(tx, booking, teacherShare, `${booking.code} yönetici iptali`);

    const body = `${lessonSummary(booking)}. Açıklama: “${reason}”.${refund > 0 ? ` ${formatMoney(refund)} iade ediliyor.` : ""}`;
    await notify({ userId: booking.studentId, type: "booking.cancelled", lesson: lessonSummary(booking), title: "Randevunuz iptal edildi", body, link: `/hesabim/derslerim/${booking.id}` }, tx);
    await notify({ userId: booking.teacherId, type: "booking.cancelled", lesson: lessonSummary(booking), title: "Ders yönetici tarafından iptal edildi", body, link: "/ogretmen-paneli/dersler" }, tx);
  });
  if (refundId) await processRefund(refundId);
}

// ---------------------------------------------------------------------------
// İtiraz
// ---------------------------------------------------------------------------

export async function openDispute(bookingId: string, studentId: string, reason: string, now = new Date()) {
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.studentId !== studentId) throw new BookingError("Randevu bulunamadı.");
    if (!["COMPLETED", "NO_SHOW_STUDENT"].includes(booking.status) || booking.earningsReleasedAt) {
      throw new BookingError("Bu ders için sorun bildirimi yapılamaz.");
    }
    if (!booking.earningsReleaseAt || booking.earningsReleaseAt <= now) {
      throw new BookingError("Sorun bildirme süresi doldu. Destek ekibimizle iletişime geçebilirsiniz.");
    }
    await transition(tx, booking, "DISPUTED", { disputedAt: now, disputeReason: reason }, studentId, reason);
    await notifyRole(
      "ADMIN",
      { type: "admin.dispute", title: "Yeni ders itirazı", body: `${booking.code}: ${reason}`, link: `/yonetim/randevular/${booking.id}` },
      tx,
    );
    await notify(
      {
        userId: booking.teacherId,
        type: "booking.disputed",
        title: "Bir dersiniz için sorun bildirildi",
        body: `${lessonSummary(booking)}. Ekibimiz inceliyor; hakediş inceleme bitene kadar bekletilecek.`,
        link: "/ogretmen-paneli/dersler",
      },
      tx,
    );
  });
}

/** İtirazı çözer: refundAmount kadar öğrenciye iade, kalan pay öğretmene serbest bırakılır. */
export async function resolveDispute(bookingId: string, adminId: string, refundAmount: number, note: string, now = new Date()) {
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.status !== "DISPUTED") throw new BookingError("Bu randevuda açık itiraz yok.");
    const remaining = booking.price - booking.refundedAmount;
    const refund = Math.min(Math.max(0, refundAmount), remaining);
    const fullRefund = refund === remaining;
    const retained = splitRetained(booking.price, booking.commissionAmount, booking.refundedAmount + refund);

    await transition(
      tx,
      booking,
      fullRefund ? "CANCELLED_BY_ADMIN" : "COMPLETED",
      { earningsReleaseAt: now, cancelledAt: fullRefund ? now : undefined, cancelReason: fullRefund ? note : undefined },
      adminId,
      `İtiraz sonucu: ${note}`,
    );
    refundId = await requestRefund(tx, booking.id, refund, `İtiraz sonucu iade: ${note}`);
    await resetPendingForBooking(tx, booking, retained.teacher, `${booking.code} itiraz sonucu hakediş`);

    const body = `${booking.code} için itiraz sonuçlandı: ${note}.${refund > 0 ? ` ${formatMoney(refund)} iade ediliyor.` : ""}`;
    await notify({ userId: booking.studentId, type: "booking.dispute_resolved", title: "İtirazınız sonuçlandı", body, link: `/hesabim/derslerim/${booking.id}` }, tx);
    await notify({ userId: booking.teacherId, type: "booking.dispute_resolved", title: "Ders itirazı sonuçlandı", body, link: "/ogretmen-paneli/kazanclar" }, tx);
  });
  if (refundId) await processRefund(refundId);
}

// ---------------------------------------------------------------------------
// Arka plan görevleri
// ---------------------------------------------------------------------------

export async function expireStaleHolds(now = new Date()): Promise<number> {
  const stale = await db.booking.findMany({
    where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
    select: { id: true, status: true },
    take: 200,
  });
  for (const booking of stale) {
    await db.$transaction((tx) => transition(tx, booking, "EXPIRED", {}, null, "Ödeme süresi doldu")).catch(() => {});
  }
  return stale.length;
}

export async function expireOverdueApprovals(now = new Date()): Promise<number> {
  const overdue = await db.booking.findMany({
    where: { status: "PENDING_APPROVAL", approvalDeadline: { lte: now } },
    take: 100,
  });
  for (const booking of overdue) {
    let refundId: string | null = null;
    try {
      await db.$transaction(async (tx) => {
        await transition(tx, booking, "EXPIRED", {}, null, "Öğretmen süresinde yanıt vermedi");
        refundId = await requestRefund(tx, booking.id, booking.price, "Öğretmen süresinde onaylamadı");
        await notify(
          {
            userId: booking.studentId,
            type: "booking.expired",
            lesson: lessonSummary(booking),
            title: booking.mode === "QUESTION" ? "Sorunuz zamanında çözülmedi" : "Talebiniz zamanında onaylanmadı",
            body: `${lessonSummary(booking)}. Öğretmen süresi içinde yanıt vermediği için talep iptal edildi. ${fullRefundText(booking)}`,
            link: "/ogretmenler",
          },
          tx,
        );
        await notify(
          {
            userId: booking.teacherId,
            type: "booking.expired",
            lesson: lessonSummary(booking),
            title: "Bir ders talebi yanıtsız kaldı",
            body: `${booking.learnerName} — ${lessonSummary(booking)}. Süresinde yanıt verilmediği için talep iptal edildi.`,
            link: "/ogretmen-paneli/talepler",
          },
          tx,
        );
      });
    } catch {
      continue;
    }
    if (refundId) await processRefund(refundId);
  }
  return overdue.length;
}

export async function completeFinishedLessons(now = new Date()): Promise<number> {
  const settings = await loadSettings();
  const due = await db.booking.findMany({
    where: { status: "CONFIRMED", endAt: { lte: now } },
    include: { attendance: { select: { userId: true } } },
    take: 100,
  });

  for (const booking of due) {
    if (booking.isTest) {
      await db.$transaction((tx) => transition(tx, booking, "COMPLETED", { completedAt: now }, null, "Test dersi bitti")).catch(() => {});
      continue;
    }
    let outcome: "COMPLETED" | "NO_SHOW_STUDENT" | "NO_SHOW_TEACHER" = "COMPLETED";
    if (booking.mode === "ONLINE" && videoConfigured()) {
      const teacherJoined = booking.attendance.some((a) => a.userId === booking.teacherId);
      const studentJoined = booking.attendance.some((a) => a.userId === booking.studentId);
      if (teacherJoined && !studentJoined) outcome = "NO_SHOW_STUDENT";
      if (!teacherJoined && studentJoined) outcome = "NO_SHOW_TEACHER";
    }

    let refundId: string | null = null;
    try {
      await db.$transaction(async (tx) => {
        const releaseAt = new Date(now.getTime() + settings.disputeWindowHours * HOUR);
        if (outcome === "NO_SHOW_TEACHER") {
          await transition(tx, booking, outcome, { completedAt: now }, null, "Öğretmen derse katılmadı");
          refundId = await requestRefund(tx, booking.id, booking.price - booking.refundedAmount, "Öğretmen derse katılmadı");
          await resetPendingForBooking(tx, booking, 0, `${booking.code} öğretmen katılmadı`);
          await tx.teacherProfile.update({ where: { userId: booking.teacherId }, data: { cancellationCount: { increment: 1 } } });
          await notify(
            { userId: booking.studentId, type: "booking.no_show_teacher", lesson: lessonSummary(booking), title: "Öğretmen derse katılmadı", body: `${lessonSummary(booking)}. ${fullRefundText(booking, "tamamen iade ediliyor")} Yaşadığınız sorun için özür dileriz.`, link: `/hesabim/derslerim/${booking.id}` },
            tx,
          );
          await notify(
            { userId: booking.teacherId, type: "booking.no_show_teacher", lesson: lessonSummary(booking), title: "Derse katılmadınız", body: `${lessonSummary(booking)}. Öğrenciye tam iade yapıldı. Bir hata olduğunu düşünüyorsanız destek ekibine yazın.`, link: "/ogretmen-paneli/dersler" },
            tx,
          );
          await notifyRole("ADMIN", { type: "admin.no_show", title: "Öğretmen derse katılmadı", body: booking.code, link: `/yonetim/randevular/${booking.id}`, email: false }, tx);
          return;
        }

        await transition(tx, booking, outcome, { completedAt: now, earningsReleaseAt: releaseAt }, null, outcome === "COMPLETED" ? "Ders tamamlandı" : "Öğrenci derse katılmadı");
        if (booking.isIntro) {
          // Ücretsiz tanışma: hakediş ve değerlendirme yok; veliye devam etme yolu gösterilir.
          if (outcome === "COMPLETED") {
            const teacher = await tx.teacherProfile.findUnique({ where: { userId: booking.teacherId }, select: { slug: true } });
            await notify(
              { userId: booking.studentId, type: "booking.intro_completed", title: "Tanışma görüşmeniz tamamlandı", body: "Öğretmenle devam etmek isterseniz profilinden ders saati seçebilirsiniz.", link: teacher ? `/ogretmen/${teacher.slug}` : "/ogretmenler" },
              tx,
            );
          }
          return;
        }
        if (outcome === "COMPLETED") {
          await tx.teacherProfile.update({ where: { userId: booking.teacherId }, data: { completedLessons: { increment: 1 } } });
          await notify(
            { userId: booking.studentId, type: "booking.completed", title: "Dersiniz tamamlandı — öğretmeninizi değerlendirin", body: `${lessonSummary(booking)}. Puan ve yorumunuz diğer velilere yol gösterir. Bir sorun yaşadıysanız ${formatDateTime(releaseAt)} saatine kadar bildirebilirsiniz.`, link: `/hesabim/derslerim/${booking.id}` },
            tx,
          );
        } else {
          await notify(
            { userId: booking.studentId, type: "booking.no_show_student", title: "Derse katılmadınız", body: `${lessonSummary(booking)}. İptal politikası gereği ders ücreti öğretmene aktarılacak. Teknik bir sorun yaşadıysanız ${formatDateTime(releaseAt)} saatine kadar bildirin.`, link: `/hesabim/derslerim/${booking.id}` },
            tx,
          );
        }
        await notify(
          { userId: booking.teacherId, type: "booking.completed", title: outcome === "COMPLETED" ? "Ders tamamlandı" : "Öğrenci derse katılmadı", body: `${lessonSummary(booking)}. ${formatMoney(booking.teacherAmount)} hakedişiniz ${formatDateTime(settledReleaseAt(releaseAt, booking.paidAt, settings.settlementDays))} sonrasında serbest kalacak.`, link: "/ogretmen-paneli/kazanclar", email: false },
          tx,
        );
      });
    } catch {
      continue;
    }
    if (refundId) await processRefund(refundId);
  }
  return due.length;
}

const RELEASABLE: BookingStatus[] = ["COMPLETED", "NO_SHOW_STUDENT", "CANCELLED_BY_STUDENT", "CANCELLED_BY_ADMIN"];

export async function releaseDueEarnings(now = new Date()): Promise<number> {
  const settings = await loadSettings();
  // Ödeme kuruluşu parayı ödemeden belirli gün sonra aktarır; o gün gelmeden hakediş serbest kalmaz.
  const settledBefore = new Date(now.getTime() - settings.settlementDays * 24 * HOUR);
  const due = await db.booking.findMany({
    where: { earningsReleaseAt: { lte: now }, earningsReleasedAt: null, status: { in: RELEASABLE }, OR: [{ paidAt: null }, { paidAt: { lte: settledBefore } }] },
    include: {
      payments: { where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } } },
    },
    take: 100,
  });
  let released = 0;

  for (const booking of due) {
    const pendingRefunds = await db.refund.count({ where: { payment: { bookingId: booking.id }, status: "PENDING" } });
    if (pendingRefunds > 0) continue;

    // Hakediş, dersin ödemesinin alındığı sağlayıcıya göre işlenir.
    const payment = booking.payments[0];
    const provider = payment && payment.provider in PAYMENT_PROVIDERS ? getProviderById(payment.provider) : getPaymentProvider();
    const amount = await pendingForBooking(db, booking.id);
    if (amount > 0) {
      const result = await provider
        .releaseToTeacher({ providerItemId: payment?.providerItemId ?? null, reference: booking.code })
        .catch((error: unknown) => ({ ok: false as const, error: String(error) }));
      if (!result.ok) continue;
    }

    await db.$transaction(async (tx) => {
      const marked = await tx.booking.updateMany({ where: { id: booking.id, earningsReleasedAt: null }, data: { earningsReleasedAt: now } });
      if (marked.count !== 1 || amount <= 0) return;
      await addLedgerEntry(tx, { teacherId: booking.teacherId, bookingId: booking.id, bucket: "PENDING", amount: -amount, description: `${booking.code} hakediş serbest bırakıldı` });
      if (provider.automaticPayouts) {
        const payout = await tx.payout.create({ data: { teacherId: booking.teacherId, amount, method: "PAYMENT_PROVIDER", reference: booking.code } });
        await addLedgerEntry(tx, { teacherId: booking.teacherId, bookingId: booking.id, payoutId: payout.id, bucket: "PAID", amount, description: `${booking.code} ödeme kuruluşu tarafından aktarıldı` });
      } else {
        await addLedgerEntry(tx, { teacherId: booking.teacherId, bookingId: booking.id, bucket: "AVAILABLE", amount, description: `${booking.code} hakediş` });
      }
      await notify(
        { userId: booking.teacherId, type: "earning.released", title: "Hakedişiniz serbest kaldı", body: `${booking.code} dersi için ${formatMoney(amount)} ${provider.automaticPayouts ? "hesabınıza aktarılıyor" : "ödenebilir bakiyenize eklendi"}.`, link: "/ogretmen-paneli/kazanclar", email: false },
        tx,
      );
    });
    released++;
  }
  return released;
}

export async function sendLessonReminders(now = new Date()): Promise<number> {
  let sent = 0;
  const in24h = new Date(now.getTime() + 24 * HOUR);
  const in1h = new Date(now.getTime() + HOUR);

  const dayAhead = await db.booking.findMany({
    where: { status: "CONFIRMED", reminder24hSentAt: null, startAt: { gt: in1h, lte: in24h } },
    take: 200,
  });
  for (const booking of dayAhead) {
    await db.$transaction(async (tx) => {
      const marked = await tx.booking.updateMany({ where: { id: booking.id, reminder24hSentAt: null }, data: { reminder24hSentAt: now } });
      if (marked.count !== 1) return;
      const body = `${lessonSummary(booking)}.${booking.mode === "ONLINE" ? " Ders saatinden 10 dakika önce sanal sınıf açılır." : ""}`;
      await notify({ userId: booking.studentId, type: "reminder.24h", title: "Yaklaşan dersiniz", body, link: `/hesabim/derslerim/${booking.id}` }, tx);
      await notify({ userId: booking.teacherId, type: "reminder.24h", title: "Yaklaşan dersiniz", body: `${booking.learnerName} — ${body}`, link: "/ogretmen-paneli/dersler" }, tx);
    });
    sent++;
  }

  const hourAhead = await db.booking.findMany({
    where: { status: "CONFIRMED", reminder1hSentAt: null, startAt: { gt: now, lte: in1h } },
    take: 200,
  });
  for (const booking of hourAhead) {
    await db.$transaction(async (tx) => {
      const marked = await tx.booking.updateMany({ where: { id: booking.id, reminder1hSentAt: null }, data: { reminder1hSentAt: now, reminder24hSentAt: booking.reminder24hSentAt ?? now } });
      if (marked.count !== 1) return;
      const link = booking.mode === "ONLINE" ? `/ders/${booking.id}` : `/hesabim/derslerim/${booking.id}`;
      await notify({ userId: booking.studentId, type: "reminder.1h", lesson: lessonSummary(booking), title: "Dersiniz 1 saat içinde başlıyor", body: lessonSummary(booking), link }, tx);
      await notify({ userId: booking.teacherId, type: "reminder.1h", lesson: lessonSummary(booking), title: "Dersiniz 1 saat içinde başlıyor", body: `${booking.learnerName} — ${lessonSummary(booking)}`, link: booking.mode === "ONLINE" ? `/ders/${booking.id}` : "/ogretmen-paneli/dersler" }, tx);
    });
    sent++;
  }
  return sent;
}

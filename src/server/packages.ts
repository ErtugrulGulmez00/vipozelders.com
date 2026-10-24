import type { LessonPackage, Prisma } from "@/generated/prisma/client";
import { formatDate, formatLessonRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BookingError, createBookingHold, packageLessonsLeft } from "./bookings";
import { newCode } from "./credits";
import { db } from "./db";
import { recordPaidOrder } from "./discounts";
import { appUrl } from "./email";
import { notify } from "./notifications";
import { getPaymentProvider, getProviderById, processRefund, salesOpen } from "./payments/service";
import { lessonPrice } from "./pricing";
import { loadSettings } from "./settings";

// Paket ders: aynı öğretmenden aynı ders ve sürede birden fazla ders peşin alınır. Öğretmen paket indirimlerini
// kendisi belirler ("5:5,10:10" → 5 derste %5, 10 derste %10). Dersler paketten düşer; tam iade gereken ders
// (öğretmen reddi, süre aşımı, erken iptal) pakete geri döner. Tekrarlayan ders bir pakettir: ödeme sonrası her
// hafta aynı gün ve saatte randevu talebi kendiliğinden oluşturulur.

export class PackageError extends Error {}

const DAY = 24 * 3_600_000;

export type PackageOffer = { lessons: number; percent: number };

export function parsePackageDiscounts(text: string, maxLessons = 50, maxPercent = 50): PackageOffer[] {
  const rows = text
    .split(/[,\n]+/)
    .map((part) => part.trim().split(/[:=]/).map((n) => Number(n.trim())))
    .filter(([lessons, percent]) => Number.isInteger(lessons) && lessons >= 2 && lessons <= maxLessons && Number.isInteger(percent) && percent >= 0 && percent <= maxPercent)
    .map(([lessons, percent]) => ({ lessons, percent }));
  return [...new Map(rows.map((r) => [r.lessons, r])).values()].sort((a, b) => a.lessons - b.lessons);
}

/** Ders sayısı için geçerli indirim: ders sayısını aşmayan en büyük paket. */
export function discountFor(offers: PackageOffer[], lessons: number): number {
  return offers.filter((o) => o.lessons <= lessons).reduce((best, o) => Math.max(best, o.percent), 0);
}

export function packageQuote(hourlyPrice: number, durationMinutes: number, lessons: number, offers: PackageOffer[]) {
  const listUnitPrice = lessonPrice(hourlyPrice, durationMinutes);
  const discountPercent = discountFor(offers, lessons);
  const unitPrice = Math.round((listUnitPrice * (100 - discountPercent)) / 100);
  return { listUnitPrice, unitPrice, discountPercent, price: unitPrice * lessons };
}

export async function saveTeacherPackageDiscounts(teacherId: string, rows: PackageOffer[]) {
  const settings = await loadSettings();
  const clean = parsePackageDiscounts(rows.map((r) => `${r.lessons}:${r.percent}`).join(","), settings.packageMaxLessons, settings.packageMaxDiscountPercent);
  await db.teacherProfile.update({ where: { userId: teacherId }, data: { packageDiscounts: clean.map((r) => `${r.lessons}:${r.percent}`).join(",") } });
  return clean;
}

export type RecurringInput = { startAt: Date; weeks: number; learnerName: string; learnerGrade?: string | null; note?: string | null };
type RecurringData = { weeks: number; learnerName: string; learnerGrade: string | null; note: string | null };

export async function createLessonPackage(studentId: string, input: { offeringId: string; durationMinutes: number; lessons: number; recurring?: RecurringInput | null }, now = new Date()) {
  if (!salesOpen()) throw new PackageError("Online ödeme altyapımız çok yakında açılıyor; şu an paket satışı yapılamıyor.");
  const settings = await loadSettings();
  if (!settings.packagesEnabled) throw new PackageError("Paket ders şu an kapalı.");
  const offering = await db.teacherOffering.findUnique({ where: { id: input.offeringId }, include: { level: true, subject: true, serviceType: true, teacher: { include: { user: true } } } });
  if (!offering || !offering.isActive) throw new PackageError("Bu ders artık sunulmuyor.");
  const teacher = offering.teacher;
  if (teacher.status !== "PUBLISHED" || teacher.user.status !== "ACTIVE") throw new PackageError("Bu öğretmen şu an ders kabul etmiyor.");
  if (teacher.userId === studentId) throw new PackageError("Kendinizden paket alamazsınız.");
  if (!offering.durations.includes(input.durationMinutes)) throw new PackageError("Seçtiğiniz ders süresi sunulmuyor.");
  const student = await db.user.findUnique({ where: { id: studentId }, select: { role: true, email: true } });
  if (student?.role !== "STUDENT") throw new PackageError("Paket yalnızca veli/öğrenci hesabıyla alınabilir.");
  if (!student.email) throw new PackageError("Ödeme için hesabınızda e-posta adresi olmalı.");
  const offers = parsePackageDiscounts(teacher.packageDiscounts, settings.packageMaxLessons, settings.packageMaxDiscountPercent);
  const recurring = input.recurring ?? null;
  const lessons = recurring ? recurring.weeks : input.lessons;
  if (!Number.isInteger(lessons) || lessons < 2 || lessons > settings.packageMaxLessons) throw new PackageError(`Paket 2 ile ${settings.packageMaxLessons} ders arasında olmalı.`);
  if (!recurring && !offers.length) throw new PackageError("Bu öğretmen paket satmıyor.");
  if (recurring) {
    if (!recurring.learnerName.trim()) throw new PackageError("Dersin kimin için olduğunu yazın.");
    if (recurring.startAt.getTime() < now.getTime() + settings.minNoticeHours * 3_600_000) throw new PackageError("İlk ders saati çok yakın; daha ileri bir saat seçin.");
  }
  const quote = packageQuote(offering.hourlyPrice, input.durationMinutes, lessons, offers);
  const recurringData: RecurringData | null = recurring ? { weeks: recurring.weeks, learnerName: recurring.learnerName.trim().slice(0, 80), learnerGrade: recurring.learnerGrade || null, note: recurring.note?.trim().slice(0, 1000) || null } : null;
  return db.lessonPackage.create({
    data: {
      code: newCode("PK"),
      studentId,
      teacherId: teacher.userId,
      offeringId: offering.id,
      serviceName: offering.serviceType.name,
      levelName: offering.level.name,
      subjectName: offering.subject.name,
      durationMinutes: input.durationMinutes,
      lessonCount: lessons,
      listUnitPrice: quote.listUnitPrice,
      unitPrice: quote.unitPrice,
      discountPercent: quote.discountPercent,
      price: quote.price,
      commissionRateBps: teacher.commissionRateBps ?? settings.commissionRateBps,
      recurringStartAt: recurring?.startAt ?? null,
      recurring: (recurringData ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function startPackageCheckout(packageId: string, studentId: string, ipAddress: string): Promise<string> {
  const pkg = await db.lessonPackage.findUnique({ where: { id: packageId }, include: { student: { include: { studentProfile: { include: { city: true } } } }, teacher: { select: { subMerchantKey: true } } } });
  if (!pkg || pkg.studentId !== studentId) throw new PackageError("Paket bulunamadı.");
  if (pkg.status !== "PENDING_PAYMENT") throw new PackageError("Bu paket için ödeme beklenmiyor.");
  const provider = getPaymentProvider();
  const payment = await db.payment.create({ data: { packageId: pkg.id, provider: provider.id, amount: pkg.price } });
  try {
    const session = await provider.createCheckout({
      paymentId: payment.id,
      bookingId: pkg.id,
      bookingCode: pkg.code,
      amount: pkg.price,
      description: `${pkg.levelName} ${pkg.subjectName} ${pkg.lessonCount} derslik paket`,
      buyer: {
        id: pkg.studentId,
        firstName: pkg.student.firstName,
        lastName: pkg.student.lastName,
        email: pkg.student.email!,
        phone: pkg.student.phone,
        ipAddress,
        city: pkg.student.studentProfile?.city?.name ?? null,
        registeredAt: pkg.student.createdAt,
      },
      teacher: { subMerchantKey: pkg.teacher.subMerchantKey, amount: 0 },
      callbackUrl: appUrl(`/api/odeme/${provider.id}/donus`),
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerToken: session.token } });
    return session.redirectUrl;
  } catch (error) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: String(error).slice(0, 300) } });
    throw new PackageError("Ödeme sayfası açılamadı. Lütfen biraz sonra tekrar deneyin.");
  }
}

/** Ödeme dönüşü: paket kullanılabilir olur; tekrarlayan dersse haftalık randevu talepleri oluşturulur. */
export async function completePackageCheckout(
  payment: { id: string; provider: string; status: string; packageId: string | null; providerToken: string | null },
  now = new Date(),
): Promise<"paid" | "failed" | "already" | "pending"> {
  if (!payment.packageId || !payment.providerToken) return "failed";
  if (payment.status !== "INITIATED") return "already";
  const result = await getProviderById(payment.provider).retrieveResult(payment.providerToken);
  if (result.status === "pending") return "pending";
  const raw = (result.raw ?? undefined) as Prisma.InputJsonValue | undefined;
  if (result.status === "failure") {
    await db.payment.updateMany({ where: { id: payment.id, status: "INITIATED" }, data: { status: "FAILED", failureReason: result.reason.slice(0, 300), raw } });
    await db.lessonPackage.updateMany({ where: { id: payment.packageId, status: "PENDING_PAYMENT" }, data: { status: "FAILED" } });
    return "failed";
  }
  const settings = await loadSettings();
  const outcome = await db.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({ where: { id: payment.id, status: "INITIATED" }, data: { status: "SUCCEEDED", providerPaymentId: result.providerPaymentId, providerItemId: result.providerItemId, raw } });
    if (updated.count === 0) return "already" as const;
    const pkg = await tx.lessonPackage.findUniqueOrThrow({ where: { id: payment.packageId! } });
    if (result.paidAmount !== pkg.price) throw new PackageError("Ödenen tutar paket ücretiyle uyuşmuyor.");
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + settings.packageValidityMonths);
    await tx.lessonPackage.update({ where: { id: pkg.id }, data: { status: "PAID", paidAt: now, expiresAt } });
    await recordPaidOrder(tx, { userId: pkg.studentId, targetType: "booking", targetId: pkg.id, discountAmount: 0, couponCode: null });
    await notify({ userId: pkg.teacherId, type: "package.sold", title: pkg.recurringStartAt ? "Yeni düzenli öğrenci" : "Yeni ders paketi satıldı", body: `${pkg.levelName} ${pkg.subjectName} · ${pkg.lessonCount} ders (${formatMoney(pkg.unitPrice)}/ders). Her ders onayladığınızda ve yapıldıkça hakedişinize eklenir.`, link: "/ogretmen-paneli/talepler", email: false }, tx);
    return "paid" as const;
  });
  if (outcome === "paid") {
    const pkg = await db.lessonPackage.findUniqueOrThrow({ where: { id: payment.packageId } });
    if (pkg.recurringStartAt) await createRecurringBookings(pkg, now);
    else await notify({ userId: pkg.studentId, type: "package.paid", title: `${pkg.lessonCount} derslik paketiniz hazır`, body: `${pkg.levelName} ${pkg.subjectName}. Öğretmeninizin takviminden saat seçip “Paketimden kullan” ile ders alabilirsiniz. Son kullanma: ${formatDate(pkg.expiresAt!)}.`, link: `/hesabim/paketlerim` });
  }
  return outcome;
}

/** Tekrarlayan dersin haftalık randevu talepleri. Saati dolu olan haftalar pakette kullanılmamış ders olarak kalır. */
export async function createRecurringBookings(pkg: LessonPackage, now = new Date()) {
  const data = pkg.recurring as RecurringData | null;
  if (!pkg.recurringStartAt || !data || !pkg.offeringId) return { created: 0, skipped: [] as Date[] };
  const skipped: Date[] = [];
  let created = 0;
  for (let i = 0; i < data.weeks; i++) {
    const startAt = new Date(pkg.recurringStartAt.getTime() + i * 7 * DAY);
    try {
      await createBookingHold(
        { studentId: pkg.studentId, offeringId: pkg.offeringId, startAt, durationMinutes: pkg.durationMinutes, mode: "ONLINE", learnerName: data.learnerName, learnerGrade: data.learnerGrade, studentNote: data.note, packageId: pkg.id },
        now,
        { ignoreMaxAdvance: true },
      );
      created++;
    } catch (error) {
      if (!(error instanceof BookingError)) throw error;
      skipped.push(startAt);
    }
  }
  await notify({
    userId: pkg.studentId,
    type: "package.recurring",
    title: "Düzenli dersleriniz planlandı",
    body: skipped.length
      ? `${created} ders için öğretmeninize talep gönderildi. ${skipped.map((d) => formatLessonRange(d, new Date(d.getTime() + pkg.durationMinutes * 60_000))).join("; ")} saatleri uygun olmadığı için bu dersler paketinizde duruyor; dilediğiniz saati seçebilirsiniz.`
      : `${created} haftalık ders için öğretmeninize talep gönderildi. Öğretmen onayladıkça bildirim alacaksınız.`,
    link: "/hesabim/paketlerim",
  });
  return { created, skipped };
}

/** Öğrencinin bu öğretmendeki kullanılabilir paketleri (kalan ders sayısıyla). */
export async function activePackages(studentId: string, teacherId?: string, now = new Date()) {
  const packages = await db.lessonPackage.findMany({ where: { studentId, status: "PAID", expiresAt: { gt: now }, ...(teacherId ? { teacherId } : {}) }, orderBy: { paidAt: "asc" } });
  const withLeft = await Promise.all(packages.map(async (p) => ({ ...p, left: await packageLessonsLeft(db, p) })));
  return withLeft.filter((p) => p.left > 0);
}

/** Erken iade önizlemesi: kullanılan dersler indirimsiz tek ders ücretinden düşülür (paket indirimi taahhüde bağlıdır). */
export async function packageRefundPreview(pkg: LessonPackage) {
  if (pkg.status !== "PAID") return { allowed: false as const, reason: "Bu paket iade edilemez." };
  const open = await db.booking.count({ where: { packageId: pkg.id, status: { in: ["PENDING_APPROVAL", "CONFIRMED"] } } });
  if (open) return { allowed: false as const, reason: "Paketten planlanmış dersleriniz var; önce onları iptal edin ya da tamamlanmasını bekleyin." };
  const left = await packageLessonsLeft(db, pkg);
  const used = pkg.lessonCount - left;
  const amount = Math.max(0, pkg.price - pkg.refundedAmount - used * pkg.listUnitPrice);
  if (left <= 0 || amount <= 0) return { allowed: false as const, reason: "İade edilecek tutar kalmadı." };
  return { allowed: true as const, amount, left, used };
}

async function closeWithRefund(pkg: LessonPackage, amount: number, reason: string, now: Date) {
  let refundId: string | null = null;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`pkg:${pkg.id}`}))`;
    const marked = await tx.lessonPackage.updateMany({ where: { id: pkg.id, status: "PAID" }, data: { status: "CLOSED", closedAt: now, refundedAmount: { increment: amount } } });
    if (marked.count !== 1) throw new PackageError("Paketin durumu değişmiş.");
    if (amount > 0) {
      const payment = await tx.payment.findFirst({ where: { packageId: pkg.id, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, orderBy: { createdAt: "desc" } });
      if (payment) refundId = (await tx.refund.create({ data: { paymentId: payment.id, amount, reason } })).id;
    }
  });
  if (refundId) await processRefund(refundId);
}

export async function refundPackage(packageId: string, studentId: string, now = new Date()) {
  const pkg = await db.lessonPackage.findUnique({ where: { id: packageId } });
  if (!pkg || pkg.studentId !== studentId) throw new PackageError("Paket bulunamadı.");
  const preview = await packageRefundPreview(pkg);
  if (!preview.allowed) throw new PackageError(preview.reason);
  await closeWithRefund(pkg, preview.amount, `Paket iadesi (${preview.left} ders kullanılmadı)`, now);
  await notify({ userId: pkg.teacherId, type: "package.refunded", title: "Bir ders paketi iade edildi", body: `${pkg.code} · ${preview.left} kullanılmamış ders iade edildi.`, link: "/ogretmen-paneli/dersler", email: false });
  return preview.amount;
}

/** Süresi dolan paketlerin kullanılmamış dersleri paketteki ders başı ücretten iade edilir. */
export async function expirePackages(now = new Date()): Promise<number> {
  const due = await db.lessonPackage.findMany({ where: { status: "PAID", expiresAt: { lte: now } }, take: 50 });
  let count = 0;
  for (const pkg of due) {
    const open = await db.booking.count({ where: { packageId: pkg.id, status: { in: ["PENDING_APPROVAL", "CONFIRMED"] }, endAt: { gt: now } } });
    if (open) continue;
    const left = await packageLessonsLeft(db, pkg);
    const amount = Math.max(0, Math.min(pkg.price - pkg.refundedAmount, left * pkg.unitPrice));
    await closeWithRefund(pkg, amount, `Paket süresi doldu (${left} ders kullanılmadı)`, now).catch(() => {});
    if (amount > 0) await notify({ userId: pkg.studentId, type: "package.expired", title: "Paketinizin süresi doldu", body: `${pkg.code}: kullanılmayan ${left} dersin ücreti (${formatMoney(amount)}) kartınıza iade ediliyor.`, link: "/hesabim/paketlerim" });
    count++;
  }
  // Ödenmeyen paketler
  const stale = await db.lessonPackage.updateMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: new Date(now.getTime() - 3_600_000) } }, data: { status: "EXPIRED" } });
  return count + stale.count;
}

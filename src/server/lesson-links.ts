import type { Prisma } from "@/generated/prisma/client";
import { formatLessonRange } from "@/lib/dates";
import { audit } from "./audit";
import { randomToken } from "./auth/password";
import { isOverlapViolation, lessonSummary, loadBusy, lockTeacher, newBookingCode } from "./bookings";
import { db } from "./db";
import { notify } from "./notifications";

// Ders bağlantısı: öğretmen belirli bir saat için ödemesiz ders bağlantısı açar ve paylaşır; bağlantıyı açan öğrenci/veli
// giriş yapıp derse kaydolur, ders o an oluşur (onaylı, online, ücretsiz). Kötüye kullanımı (ücreti platform dışında
// alıp dersi bedava açma) önlemek için serbest yetkisi olmayan öğretmen yalnızca ücreti ödenmiş bir dersinin telafisi
// için ve gerekçe yazarak bağlantı açar; bağlantıyı yalnızca o dersin öğrencisi kullanabilir, her ücretli derse tek
// telafi. Telafi yalnızca yapılamamış online derse açılır (öğretmen ve öğrenci ikisi de sınıfa girdiyse ders yapılmış
// sayılır); telafisi açılan dersin sınıfı kapanır, ders telafi saatinde yapılır. Serbest yetkiyi (ör. öğrenci koçu)
// yönetici verir.

export class LessonLinkError extends Error {}

export const LINK_DURATIONS = [30, 45, 60, 90, 120];
/** Telafisi açılabilecek dersin en eski başlangıcı (gün) */
export const MAKEUP_WINDOW_DAYS = 30;
const MAX_DAYS_AHEAD = 60;
export const NOTE_MIN_LENGTH = 15;
/** Serbest bağlantıda katalog dışı genel görüşme seçeneği */
export const GENERAL_OFFERING = "genel";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Telafi bağlantısı açılabilecek ücretli dersler: online, onaylı ya da tamamlanmış, iadesiz, son 30 günde, telafisi
 * açılmamış ve öğretmenle öğrencinin ikisinin birden sınıfa girmediği. Yüz yüze derste kimin geldiği bilinmediği için
 * telafi açılmaz. Yoklamaya yalnızca dersin öğretmeni ve öğrencisi yazılır; öğretmen dışındaki kayıt öğrencinindir.
 */
function makeupSourceWhere(teacherId: string, now: Date): Prisma.BookingWhereInput {
  return {
    teacherId,
    isTest: false,
    isIntro: false,
    mode: "ONLINE",
    price: { gt: 0 },
    refundedAmount: 0,
    status: { in: ["CONFIRMED", "COMPLETED"] },
    startAt: { gte: new Date(now.getTime() - MAKEUP_WINDOW_DAYS * DAY) },
    makeupLinks: { none: { cancelledAt: null } },
    NOT: { AND: [{ attendance: { some: { userId: teacherId } } }, { attendance: { some: { userId: { not: teacherId } } } }] },
  };
}

/** Bu ders için telafi bağlantısı açılabilir mi? (Ders sayfasındaki düğme için.) */
export async function canOpenMakeup(teacherId: string, bookingId: string, now = new Date()) {
  return (await db.booking.count({ where: { id: bookingId, ...makeupSourceWhere(teacherId, now) } })) > 0;
}

/** Dersin iptal edilmemiş telafi bağlantısı: varsa ders yapılmaz, sınıfı kapalıdır. */
export async function activeMakeup(bookingId: string) {
  return db.lessonLink.findFirst({ where: { sourceBookingId: bookingId, cancelledAt: null }, select: { token: true, startAt: true, endAt: true, bookingId: true } });
}

export async function makeupSources(teacherId: string, now = new Date()) {
  return db.booking.findMany({
    where: makeupSourceWhere(teacherId, now),
    orderBy: { startAt: "desc" },
    take: 50,
    select: { id: true, code: true, startAt: true, endAt: true, learnerName: true, levelName: true, subjectName: true, serviceName: true, mode: true },
  });
}

export type NewLessonLink = {
  teacherId: string;
  startAt: Date;
  durationMinutes: number;
  /** Serbest bağlantıda öğretmenin dersi (TeacherOffering id) ya da GENERAL_OFFERING */
  offeringId?: string | null;
  /** Telafi edilen ücretli ders */
  sourceBookingId?: string | null;
  note?: string | null;
};

export async function createLessonLink(input: NewLessonLink, now = new Date()) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: input.teacherId },
    select: { userId: true, freeLessonLinks: true, user: { select: { status: true, firstName: true, lastName: true } } },
  });
  if (!teacher || teacher.user.status !== "ACTIVE") throw new LessonLinkError("Öğretmen hesabı bulunamadı.");
  if (!LINK_DURATIONS.includes(input.durationMinutes)) throw new LessonLinkError("Geçersiz ders süresi.");
  if (Number.isNaN(input.startAt.getTime()) || input.startAt.getTime() < now.getTime() - 5 * 60_000) throw new LessonLinkError("Ders saati geçmişte olamaz.");
  if (input.startAt.getTime() > now.getTime() + MAX_DAYS_AHEAD * DAY) throw new LessonLinkError(`En fazla ${MAX_DAYS_AHEAD} gün sonrası için bağlantı açılabilir.`);
  const note = input.note?.trim().slice(0, 500) || null;
  const sourceBookingId = input.sourceBookingId || null;
  if (!teacher.freeLessonLinks) {
    if (!sourceBookingId) throw new LessonLinkError("Telafi edeceğiniz ücretli dersi seçin.");
    if (!note || note.length < NOTE_MIN_LENGTH) throw new LessonLinkError(`Gerekçeyi yazın (en az ${NOTE_MIN_LENGTH} karakter): hangi ders neden yapılamadı?`);
  }

  const endAt = new Date(input.startAt.getTime() + input.durationMinutes * 60_000);
  const token = randomToken(12);

  const link = await db.$transaction(async (tx) => {
    await lockTeacher(tx, teacher.userId);
    const source = sourceBookingId ? await tx.booking.findFirst({ where: { id: sourceBookingId, ...makeupSourceWhere(teacher.userId, now) } }) : null;
    if (sourceBookingId && !source) {
      throw new LessonLinkError("Seçilen ders telafiye uygun değil (yüz yüze, iade edilmiş, çok eski, ikinizin de katıldığı ya da telafisi zaten açılmış bir ders olabilir).");
    }

    let catalog: { serviceTypeId: number; levelId: number; subjectId: number; serviceName: string; levelName: string; subjectName: string };
    if (source) {
      catalog = { serviceTypeId: source.serviceTypeId, levelId: source.levelId, subjectId: source.subjectId, serviceName: "Telafi dersi", levelName: source.levelName, subjectName: source.subjectName };
    } else if (input.offeringId && input.offeringId !== GENERAL_OFFERING) {
      const offering = await tx.teacherOffering.findFirst({ where: { id: input.offeringId, teacherId: teacher.userId }, include: { serviceType: true, level: true, subject: true } });
      if (!offering) throw new LessonLinkError("Ders bulunamadı.");
      catalog = { serviceTypeId: offering.serviceTypeId, levelId: offering.levelId, subjectId: offering.subjectId, serviceName: offering.serviceType.name, levelName: offering.level.name, subjectName: offering.subject.name };
    } else {
      // Katalog dışı genel görüşme (koçluk): kayıt için ilk kademe/ders kullanılır, adlar genel yazılır
      const [service, level, subject] = await Promise.all([
        tx.serviceType.findFirst({ where: { slug: "kocluk" } }).then((s) => s ?? tx.serviceType.findFirstOrThrow({ orderBy: { sortOrder: "asc" } })),
        tx.level.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }),
        tx.subject.findFirstOrThrow({ orderBy: { sortOrder: "asc" } }),
      ]);
      catalog = { serviceTypeId: service.id, levelId: level.id, subjectId: subject.id, serviceName: service.name, levelName: "Genel", subjectName: "görüşme" };
    }

    const busy = await loadBusy(tx, teacher.userId, new Date(input.startAt.getTime() - DAY), new Date(endAt.getTime() + DAY), now);
    if (busy.some((b) => input.startAt < b.end && b.start < endAt)) throw new LessonLinkError("Bu saatte başka bir dersiniz ya da bağlantınız var.");

    const created = await tx.lessonLink.create({
      data: { token, teacherId: teacher.userId, startAt: input.startAt, endAt, durationMinutes: input.durationMinutes, ...catalog, note, sourceBookingId: source?.id ?? null },
    });
    if (source) {
      await notify(
        {
          userId: source.studentId,
          type: "booking.makeup_link",
          title: "Telafi dersi bağlantısı",
          body: `${teacher.user.firstName} ${teacher.user.lastName}, ${lessonSummary(source)} dersiniz için ${formatLessonRange(input.startAt, endAt)} saatinde telafi dersi açtı. Bağlantıyı açıp derse kaydolun.`,
          link: `/ders-baglantisi/${token}`,
        },
        tx,
      );
    }
    await audit(
      { actorId: teacher.userId, action: "lesson_link.create", entityType: "LessonLink", entityId: created.id, details: { free: !source, sourceBookingId: source?.id ?? null, note } },
      tx,
    );
    return created;
  });
  return link;
}

export async function cancelLessonLink(linkId: string, teacherId: string, now = new Date()) {
  const link = await db.lessonLink.findUnique({ where: { id: linkId } });
  if (!link || link.teacherId !== teacherId) throw new LessonLinkError("Bağlantı bulunamadı.");
  if (link.bookingId) throw new LessonLinkError("Bu bağlantıyla ders oluştu; dersi Derslerim sayfasından iptal edebilirsiniz.");
  if (link.cancelledAt) return;
  await db.lessonLink.update({ where: { id: linkId }, data: { cancelledAt: now } });
  await audit({ actorId: teacherId, action: "lesson_link.cancel", entityType: "LessonLink", entityId: linkId });
}

export async function findLessonLink(token: string) {
  return db.lessonLink.findUnique({
    where: { token },
    include: {
      teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
      booking: { select: { id: true, studentId: true } },
      sourceBooking: { select: { studentId: true, code: true, refundedAmount: true } },
    },
  });
}

/**
 * Öğrenci/veli bağlantıyla derse kaydolur: ödemesiz, onaylı online ders oluşur. Bağlantıyı aynı hesap ikinci kez
 * açarsa mevcut ders döner. Telafi bağlantısını yalnızca kaynak dersin öğrencisi kullanabilir.
 */
export async function claimLessonLink(token: string, userId: string, now = new Date()) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { studentProfile: true } });
  if (!user || user.role !== "STUDENT" || !user.studentProfile) throw new LessonLinkError("Derse kaydolmak için öğrenci/veli hesabıyla giriş yapın.");
  const found = await db.lessonLink.findUnique({ where: { token }, select: { teacherId: true } });
  if (!found) throw new LessonLinkError("Bağlantı geçersiz.");

  try {
    return await db.$transaction(async (tx) => {
      await lockTeacher(tx, found.teacherId);
      const link = await tx.lessonLink.findUniqueOrThrow({
        where: { token },
        include: { booking: true, sourceBooking: true, teacher: { select: { user: { select: { status: true } } } } },
      });
      if (link.booking) {
        if (link.booking.studentId === user.id) return link.booking;
        throw new LessonLinkError("Bu bağlantı başka bir hesapla kullanıldı.");
      }
      if (link.cancelledAt) throw new LessonLinkError("Öğretmen bu bağlantıyı iptal etti.");
      if (link.endAt <= now) throw new LessonLinkError("Bu bağlantının süresi doldu.");
      if (link.teacher.user.status !== "ACTIVE") throw new LessonLinkError("Öğretmen hesabı kapalı.");
      if (link.sourceBooking && link.sourceBooking.studentId !== user.id) throw new LessonLinkError("Bu telafi bağlantısını yalnızca dersin öğrencisi/velisi kullanabilir. Dersi aldığınız hesapla giriş yapın.");
      // Kaynak dersin ücreti sonradan iade edildiyse (iptal, öğretmen katılmadı) telafi de geçersizdir
      if (link.sourceBooking && link.sourceBooking.refundedAmount > 0) throw new LessonLinkError("Telafi edilecek dersin ücreti iade edildiği için bu bağlantı geçersiz.");

      const booking = await tx.booking.create({
        data: {
          code: `BAG-${newBookingCode().slice(3)}`,
          studentId: user.id,
          teacherId: link.teacherId,
          learnerId: link.sourceBooking?.learnerId ?? null,
          serviceTypeId: link.serviceTypeId,
          levelId: link.levelId,
          subjectId: link.subjectId,
          serviceName: link.serviceName,
          levelName: link.levelName,
          subjectName: link.subjectName,
          learnerName: link.sourceBooking?.learnerName ?? user.firstName,
          learnerGrade: link.sourceBooking?.learnerGrade ?? null,
          mode: "ONLINE",
          startAt: link.startAt,
          endAt: link.endAt,
          blockEndAt: link.endAt,
          durationMinutes: link.durationMinutes,
          price: 0,
          commissionRateBps: 0,
          commissionAmount: 0,
          teacherAmount: 0,
          status: "CONFIRMED",
          confirmedAt: now,
          respondedAt: now,
          videoRoomName: `vd-bag-${randomToken(9).toLowerCase()}`,
          isTest: true,
        },
      });
      await tx.lessonLink.update({ where: { id: link.id }, data: { bookingId: booking.id } });
      await tx.bookingEvent.create({
        data: { bookingId: booking.id, toStatus: "CONFIRMED", actorId: user.id, note: link.sourceBooking ? `Telafi bağlantısıyla oluşturuldu (${link.sourceBooking.code}, ödemesiz)` : "Ders bağlantısıyla oluşturuldu (ödemesiz)" },
      });
      const when = `${formatLessonRange(booking.startAt, booking.endAt)}. Ders sınıfı, ders saatinden 10 dakika önce açılır.`;
      await notify({ userId: user.id, type: "booking.link_claimed", title: "Dersiniz oluşturuldu", body: `${lessonSummary(booking)}. ${when}`, link: `/hesabim/derslerim/${booking.id}`, email: false }, tx);
      await notify(
        { userId: link.teacherId, type: "booking.link_claimed", title: "Ders bağlantınız kullanıldı", body: `${user.firstName} ${user.lastName.charAt(0)}. derse kaydoldu. ${when}`, link: `/ogretmen-paneli/dersler/${booking.id}` },
        tx,
      );
      return booking;
    });
  } catch (error) {
    if (isOverlapViolation(error)) throw new LessonLinkError("Öğretmenin bu saatte başka bir dersi var.");
    throw error;
  }
}

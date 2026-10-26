import type { Booking } from "@/generated/prisma/client";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BookingError, lessonSummary } from "./bookings";
import { db } from "./db";
import { addLedgerEntry } from "./ledger";
import { notify } from "./notifications";
import { getPaymentProvider, salesOpen } from "./payments/service";
import { settledReleaseAt, splitCommission } from "./pricing";
import { loadSettings } from "./settings";
import { deleteUpload, saveUpload, UploadError } from "./storage";

// Fotoğrafla soru (pazaryeri): öğrenci soru başı ücreti öder, öğretmen süresi içinde yazılı/fotoğraflı/videolu
// çözüm gönderir. Randevu kaydının QUESTION türüdür; ödeme, iade, komisyon ve hakediş dersle aynı işler.
// Durumlar: PENDING_PAYMENT → PENDING_APPROVAL (çözüm bekleniyor) → COMPLETED (çözüldü).
// Süresinde çözülmezse mevcut onay süresi görevi talebi düşürüp tam iade yapar.

const HOUR = 3_600_000;
const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 25 * 1024 * 1024;

async function upload(file: File, kind: "image" | "video") {
  try {
    return await saveUpload(file, { visibility: "private", folder: "soru-cozum", maxBytes: kind === "image" ? IMAGE_MAX : VIDEO_MAX, kinds: [kind] });
  } catch (error) {
    if (error instanceof UploadError) throw new BookingError(error.message);
    throw error;
  }
}

const hasFile = (file: File | null | undefined): file is File => Boolean(file && file.size > 0);

export type QuestionHoldInput = {
  studentId: string;
  offeringId: string;
  learnerName: string;
  learnerGrade?: string | null;
  note?: string | null;
  image: File | null;
};

/** Soru fotoğrafını kaydeder ve ödeme için bekleyen soru kaydını oluşturur. */
export async function createQuestionHold(input: QuestionHoldInput, now = new Date()): Promise<Booking> {
  if (!salesOpen()) throw new BookingError("Online ödeme altyapımız çok yakında açılıyor; şu an ders ve soru satışı yapılamıyor.");
  const settings = await loadSettings();
  const offering = await db.teacherOffering.findUnique({
    where: { id: input.offeringId },
    include: { level: true, subject: true, serviceType: true, teacher: { include: { user: true } } },
  });
  if (!offering || !offering.isActive || !offering.questionPrice) throw new BookingError("Bu öğretmen bu ders için fotoğrafla soru kabul etmiyor.");
  const teacher = offering.teacher;
  if (teacher.status !== "PUBLISHED" || teacher.user.status !== "ACTIVE") throw new BookingError("Bu öğretmen şu an soru kabul etmiyor.");
  if (teacher.userId === input.studentId) throw new BookingError("Kendinize soru gönderemezsiniz.");
  const provider = getPaymentProvider();
  if (provider.requiresSubMerchant && !teacher.subMerchantKey) throw new BookingError("Öğretmenin ödeme hesabı henüz tamamlanmadığı için şu an soru gönderilemiyor.");

  const learnerName = input.learnerName.trim();
  if (!learnerName) throw new BookingError("Sorunun kimin için olduğunu yazın.");
  if (!hasFile(input.image)) throw new BookingError("Sorunun fotoğrafını ekleyin.");
  const imageKey = await upload(input.image, "image");

  const price = offering.questionPrice;
  const commissionRateBps = teacher.commissionRateBps ?? settings.commissionRateBps;
  const { commissionAmount, teacherAmount } = splitCommission(price, commissionRateBps);
  const code = newQuestionCode();

  try {
    return await db.$transaction(async (tx) => {
      const learner = await tx.learner.upsert({
        where: { studentId_name: { studentId: input.studentId, name: learnerName } },
        create: { studentId: input.studentId, name: learnerName, gradeName: input.learnerGrade || null },
        update: input.learnerGrade ? { gradeName: input.learnerGrade } : {},
      });
      const booking = await tx.booking.create({
        data: {
          code,
          studentId: input.studentId,
          teacherId: teacher.userId,
          offeringId: offering.id,
          learnerId: learner.id,
          serviceTypeId: offering.serviceTypeId,
          levelId: offering.levelId,
          subjectId: offering.subjectId,
          serviceName: offering.serviceType.name,
          levelName: offering.level.name,
          subjectName: offering.subject.name,
          learnerName,
          learnerGrade: input.learnerGrade || null,
          mode: "QUESTION",
          studentNote: input.note?.trim() || null,
          // Saat tutmaz: başlangıç = bitiş (çakışma kuralına takılmaz).
          startAt: now,
          endAt: now,
          blockEndAt: now,
          durationMinutes: 0,
          price,
          commissionRateBps,
          commissionAmount,
          teacherAmount,
          status: "PENDING_PAYMENT",
          holdExpiresAt: new Date(now.getTime() + settings.paymentHoldMinutes * 60_000),
        },
      });
      await tx.bookingMessage.create({ data: { bookingId: booking.id, authorId: input.studentId, body: input.note?.trim() || null, imageKey } });
      await tx.bookingEvent.create({ data: { bookingId: booking.id, toStatus: "PENDING_PAYMENT", actorId: input.studentId, note: "Soru gönderildi, ödeme bekleniyor" } });
      return booking;
    });
  } catch (error) {
    await deleteUpload(imageKey);
    throw error;
  }
}

function newQuestionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SC-";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/** Yazışma açık mı? Çözüm bekleyen ve çözülmüş (itiraz süresi bitmemiş) sorularda iki taraf da yazabilir. */
export function threadOpen(booking: Pick<Booking, "status" | "earningsReleasedAt">): boolean {
  return ["PENDING_APPROVAL", "COMPLETED", "DISPUTED"].includes(booking.status) && !booking.earningsReleasedAt;
}

export type QuestionMessageInput = { body: string | null; image: File | null; video: File | null; isSolution: boolean };

/** Öğrenci ya da öğretmen mesaj/çözüm ekler. Öğretmenin "çözüm" işaretli ilk mesajı soruyu tamamlar. */
export async function addQuestionMessage(bookingId: string, user: { id: string; role: string }, input: QuestionMessageInput, now = new Date()) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.mode !== "QUESTION") throw new BookingError("Soru bulunamadı.");
  const isTeacher = booking.teacherId === user.id;
  if (!isTeacher && booking.studentId !== user.id) throw new BookingError("Soru bulunamadı.");
  if (!threadOpen(booking)) throw new BookingError("Bu soru için yazışma kapandı.");
  const body = input.body?.trim() || null;
  if (!body && !hasFile(input.image) && !hasFile(input.video)) throw new BookingError("Mesaj yazın ya da fotoğraf/video ekleyin.");
  if (hasFile(input.video) && !isTeacher) throw new BookingError("Video yalnızca öğretmen çözümlerinde eklenebilir.");

  const imageKey = hasFile(input.image) ? await upload(input.image, "image") : null;
  const videoKey = hasFile(input.video) ? await upload(input.video, "video") : null;
  const solves = isTeacher && input.isSolution && booking.status === "PENDING_APPROVAL";
  const settings = await loadSettings();

  try {
    await db.$transaction(async (tx) => {
      await tx.bookingMessage.create({ data: { bookingId, authorId: user.id, body, imageKey, videoKey, isSolution: isTeacher && input.isSolution } });
      if (solves) {
        const releaseAt = new Date(now.getTime() + settings.disputeWindowHours * HOUR);
        const updated = await tx.booking.updateMany({
          where: { id: bookingId, status: "PENDING_APPROVAL" },
          data: { status: "COMPLETED", answeredAt: now, respondedAt: now, confirmedAt: now, completedAt: now, earningsReleaseAt: releaseAt },
        });
        if (updated.count !== 1) throw new BookingError("Sorunun durumu değişmiş. Sayfayı yenileyin.");
        await tx.bookingEvent.create({ data: { bookingId, fromStatus: "PENDING_APPROVAL", toStatus: "COMPLETED", actorId: user.id, note: "Öğretmen çözümü gönderdi" } });
        await addLedgerEntry(tx, { teacherId: booking.teacherId, bookingId, bucket: "PENDING", amount: booking.teacherAmount, description: `${booking.code} soru çözüm ücreti (itiraz süresi sonrası serbest kalır)` });
        await tx.teacherProfile.update({ where: { userId: booking.teacherId }, data: { completedLessons: { increment: 1 } } });
        await notify(
          {
            userId: booking.studentId,
            type: "question.solved",
            lesson: lessonSummary(booking),
            title: "Sorunuzun çözümü geldi",
            body: `${lessonSummary(booking)}. Çözümü inceleyin; anlamadığınız yeri öğretmeninize yazabilirsiniz. Bir sorun varsa ${formatDateTime(releaseAt)} saatine kadar bildirebilirsiniz.`,
            link: `/hesabim/derslerim/${bookingId}`,
          },
          tx,
        );
        await notify(
          { userId: booking.teacherId, type: "booking.completed", title: "Çözüm gönderildi", body: `${lessonSummary(booking)}. ${formatMoney(booking.teacherAmount)} hakedişiniz ${formatDateTime(settledReleaseAt(releaseAt, booking.paidAt, settings.settlementDays))} sonrasında serbest kalacak.`, link: "/ogretmen-paneli/kazanclar", email: false },
          tx,
        );
      } else {
        await notify(
          isTeacher
            ? { userId: booking.studentId, type: "question.message", title: "Öğretmeninizden mesaj", body: `${lessonSummary(booking)}${body ? `: ${body.slice(0, 120)}` : ""}`, link: `/hesabim/derslerim/${bookingId}` }
            : { userId: booking.teacherId, type: "question.message", title: "Öğrenciden mesaj", body: `${booking.learnerName} · ${lessonSummary(booking)}${body ? `: ${body.slice(0, 120)}` : ""}`, link: `/ogretmen-paneli/dersler/${bookingId}` },
          tx,
        );
      }
    });
  } catch (error) {
    await deleteUpload(imageKey);
    await deleteUpload(videoKey);
    throw error;
  }
  return { solved: solves };
}

/** Yazışma (en eskiden yeniye) ve yazarların adları. */
export async function questionThread(bookingId: string) {
  return db.bookingMessage.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

import { formatLessonRange } from "@/lib/dates";
import { BookingError, lessonSummary, lockTeacher, rescheduleSlotFree } from "./bookings";
import { db } from "./db";
import { notify } from "./notifications";
import { loadSettings } from "./settings";

// Erteleme: onaylı dersin saatini bir taraf önerir (veli ya da öğretmen), diğer taraf kabul ederse ders yeni saate
// taşınır. Öneri dersten en az belirli saat önce yapılır; ders başına sınırlı sayıda erteleme yapılabilir.
// Yanıtlanmayan öneri, ders saatine bu süreden az kalınca düşer.

const HOUR = 3_600_000;

function roleIn(booking: { studentId: string; teacherId: string }, userId: string) {
  if (booking.studentId === userId) return "student" as const;
  if (booking.teacherId === userId) return "teacher" as const;
  return null;
}

/** Erteleme önerilebilir mi? (Sayfada formu göstermek için de kullanılır.) */
export async function rescheduleAllowed(booking: { status: string; startAt: Date; rescheduleCount: number; mode: string; isIntro: boolean }, now = new Date()) {
  const settings = await loadSettings();
  if (booking.status !== "CONFIRMED" || booking.mode === "QUESTION") return { ok: false as const, reason: "Yalnızca onaylanmış dersler ertelenebilir." };
  if (booking.rescheduleCount >= settings.rescheduleMaxPerBooking) return { ok: false as const, reason: `Bu ders en fazla ${settings.rescheduleMaxPerBooking} kez ertelenebilir.` };
  if (booking.startAt.getTime() - now.getTime() < settings.rescheduleMinHours * HOUR) return { ok: false as const, reason: `Erteleme dersten en az ${settings.rescheduleMinHours} saat önce önerilebilir.` };
  return { ok: true as const, minHours: settings.rescheduleMinHours };
}

export async function requestReschedule(bookingId: string, userId: string, newStartAt: Date, note: string | null, now = new Date()) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  const role = booking ? roleIn(booking, userId) : null;
  if (!booking || !role) throw new BookingError("Ders bulunamadı.");
  const allowed = await rescheduleAllowed(booking, now);
  if (!allowed.ok) throw new BookingError(allowed.reason);
  if (Number.isNaN(newStartAt.getTime()) || newStartAt.getTime() === booking.startAt.getTime()) throw new BookingError("Yeni bir saat seçin.");
  const request = await db.$transaction(async (tx) => {
    await lockTeacher(tx, booking.teacherId);
    if (await tx.rescheduleRequest.count({ where: { bookingId, status: "PENDING" } })) throw new BookingError("Bu ders için yanıt bekleyen bir erteleme önerisi zaten var.");
    if (!(await rescheduleSlotFree(tx, booking, newStartAt, now))) throw new BookingError("Seçtiğiniz saat öğretmenin takviminde uygun değil.");
    return tx.rescheduleRequest.create({ data: { bookingId, requestedById: userId, newStartAt, note: note?.trim().slice(0, 300) || null } });
  });
  const newRange = formatLessonRange(newStartAt, new Date(newStartAt.getTime() + booking.durationMinutes * 60_000));
  await notify(
    role === "student"
      ? { userId: booking.teacherId, type: "booking.reschedule_request", lesson: lessonSummary(booking), title: "Ders saati değişikliği önerisi", body: `${booking.learnerName} · ${lessonSummary(booking)} → ${newRange}${request.note ? `. Not: “${request.note}”` : ""}`, link: `/ogretmen-paneli/dersler/${booking.id}` }
      : { userId: booking.studentId, type: "booking.reschedule_request", lesson: lessonSummary(booking), title: "Öğretmeniniz ders saatini değiştirmek istiyor", body: `${lessonSummary(booking)} → ${newRange}${request.note ? `. Not: “${request.note}”` : ""}`, link: `/hesabim/derslerim/${booking.id}` },
  );
  return request;
}

export async function respondReschedule(requestId: string, userId: string, accept: boolean, now = new Date()) {
  const request = await db.rescheduleRequest.findUnique({ where: { id: requestId }, include: { booking: true } });
  if (!request || request.status !== "PENDING") throw new BookingError("Bu öneri artık geçerli değil.");
  const { booking } = request;
  const role = roleIn(booking, userId);
  if (!role || request.requestedById === userId) throw new BookingError("Bu öneriyi yalnızca karşı taraf yanıtlayabilir.");
  const oldRange = formatLessonRange(booking.startAt, booking.endAt);
  const newEnd = new Date(request.newStartAt.getTime() + booking.durationMinutes * 60_000);
  if (!accept) {
    await db.rescheduleRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "DECLINED", respondedAt: now } });
    await notify({ userId: request.requestedById, type: "booking.reschedule_declined", title: "Saat değişikliği kabul edilmedi", body: `${lessonSummary(booking)}: ders eski saatinde (${oldRange}) devam ediyor.`, link: request.requestedById === booking.teacherId ? `/ogretmen-paneli/dersler/${booking.id}` : `/hesabim/derslerim/${booking.id}` });
    return;
  }
  await db.$transaction(async (tx) => {
    await lockTeacher(tx, booking.teacherId);
    const fresh = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
    if (fresh.status !== "CONFIRMED" || fresh.startAt.getTime() !== booking.startAt.getTime()) throw new BookingError("Dersin durumu değişmiş.");
    if (!(await rescheduleSlotFree(tx, fresh, request.newStartAt, now))) throw new BookingError("Önerilen saat artık uygun değil; yeni bir saat önerin.");
    const marked = await tx.rescheduleRequest.updateMany({ where: { id: requestId, status: "PENDING" }, data: { status: "ACCEPTED", respondedAt: now } });
    if (marked.count !== 1) throw new BookingError("Bu öneri artık geçerli değil.");
    await tx.booking.update({
      where: { id: booking.id },
      data: { startAt: request.newStartAt, endAt: newEnd, blockEndAt: newEnd, rescheduleCount: { increment: 1 }, reminder24hSentAt: null, reminder1hSentAt: null },
    });
    await tx.bookingEvent.create({ data: { bookingId: booking.id, fromStatus: "CONFIRMED", toStatus: "CONFIRMED", actorId: userId, note: `Ders saati değişti: ${oldRange} → ${formatLessonRange(request.newStartAt, newEnd)}` } });
  });
  const body = `${booking.levelName} ${booking.subjectName}: yeni saat ${formatLessonRange(request.newStartAt, newEnd)} (eski: ${oldRange}).`;
  await notify({ userId: booking.studentId, type: "booking.rescheduled", lesson: `${booking.levelName} ${booking.subjectName} — ${formatLessonRange(request.newStartAt, newEnd)}`, title: "Ders saati değişti", body, link: `/hesabim/derslerim/${booking.id}` });
  await notify({ userId: booking.teacherId, type: "booking.rescheduled", lesson: `${booking.levelName} ${booking.subjectName} — ${formatLessonRange(request.newStartAt, newEnd)}`, title: "Ders saati değişti", body, link: `/ogretmen-paneli/dersler/${booking.id}` });
}

export async function cancelRescheduleRequest(requestId: string, userId: string, now = new Date()) {
  const updated = await db.rescheduleRequest.updateMany({ where: { id: requestId, requestedById: userId, status: "PENDING" }, data: { status: "CANCELLED", respondedAt: now } });
  if (updated.count !== 1) throw new BookingError("Bu öneri artık geçerli değil.");
}

/** Ders saatine erteleme süresinden az kalan ya da 48 saattir yanıtlanmayan öneriler düşer. */
export async function expireRescheduleRequests(now = new Date()): Promise<number> {
  const settings = await loadSettings();
  const result = await db.rescheduleRequest.updateMany({
    where: { status: "PENDING", OR: [{ createdAt: { lt: new Date(now.getTime() - 48 * HOUR) } }, { booking: { startAt: { lt: new Date(now.getTime() + settings.rescheduleMinHours * HOUR) } } }, { booking: { status: { not: "CONFIRMED" } } }] },
    data: { status: "EXPIRED", respondedAt: now },
  });
  return result.count;
}

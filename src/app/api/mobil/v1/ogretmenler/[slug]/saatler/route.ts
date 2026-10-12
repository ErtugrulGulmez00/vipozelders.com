import { formatDayLabel, formatTime, isDateString, toLocalDateString } from "@/lib/dates";
import { getTeacherSlots } from "@/server/bookings";
import { db } from "@/server/db";
import { ApiError, json, notFound } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";

/** Seçilen süre için 7 günlük boş/dolu saatler: ?duration=60&start=2026-10-14 */
export const GET = publicRoute<{ slug: string }>(async ({ request, params }) => {
  const url = new URL(request.url);
  const duration = Number(url.searchParams.get("duration"));
  if (![30, 45, 60, 90, 120].includes(duration)) throw new ApiError(400, "INVALID_DURATION", "Geçersiz süre.");
  const teacher = await db.teacherProfile.findUnique({ where: { slug: params.slug }, select: { userId: true, status: true, user: { select: { status: true } } } });
  if (!teacher || teacher.status !== "PUBLISHED" || teacher.user.status !== "ACTIVE") throw notFound("Öğretmen bulunamadı.");

  const now = new Date();
  const today = toLocalDateString(now);
  const requested = url.searchParams.get("start") ?? "";
  const startDate = isDateString(requested) && requested > today ? requested : today;
  const days = await getTeacherSlots(teacher.userId, { durationMinutes: duration, startDate, days: 7 }, now);
  return json({
    startDate,
    durationMinutes: duration,
    days: days.map((day) => ({
      date: day.date,
      ...formatDayLabel(day.date),
      slots: day.slots.map((slot) => ({ startAt: slot.start, endAt: slot.end, time: formatTime(slot.start), available: slot.available })),
    })),
  });
});

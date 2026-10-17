import { NextResponse, type NextRequest } from "next/server";
import { formatDayLabel, formatTime, isDateString, toLocalDateString } from "@/lib/dates";
import { getTeacherSlots } from "@/server/bookings";
import { db } from "@/server/db";

/** Öğretmenin seçilen süreye göre bir haftalık boş/dolu saatleri. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const teacherId = searchParams.get("ogretmen") ?? "";
  const duration = Number(searchParams.get("sure"));
  const requestedStart = searchParams.get("baslangic") ?? "";
  // 15 dk: ücretsiz tanışma görüşmesi
  if (![15, 45, 60].includes(duration)) {
    return NextResponse.json({ error: "Geçersiz süre." }, { status: 400 });
  }

  const teacher = await db.teacherProfile.findUnique({ where: { userId: teacherId }, select: { status: true } });
  if (!teacher || teacher.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
  }

  const now = new Date();
  const today = toLocalDateString(now);
  const startDate = isDateString(requestedStart) && requestedStart > today ? requestedStart : today;
  const days = await getTeacherSlots(teacherId, { durationMinutes: duration, startDate, days: 7 }, now);

  return NextResponse.json(
    {
      startDate,
      days: days.map((day) => ({
        date: day.date,
        ...formatDayLabel(day.date),
        slots: day.slots.map((slot) => ({ start: slot.start.toISOString(), time: formatTime(slot.start), available: slot.available })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

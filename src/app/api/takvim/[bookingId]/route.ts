import { icsFile } from "@/lib/calendar";
import { shortName } from "@/lib/text";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { lessonCalendarEvent } from "@/server/lesson-calendar";

/** Onaylı dersin .ics takvim dosyası (yalnızca dersin öğretmeni ve velisi indirebilir). */
export async function GET(_request: Request, { params }: RouteContext<"/api/takvim/[bookingId]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Giriş yapın.", { status: 401 });
  const { bookingId } = await params;
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { district: { include: { city: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  const viewer = booking?.studentId === user.id ? "STUDENT" : booking?.teacherId === user.id ? "TEACHER" : null;
  if (!booking || !viewer || !["CONFIRMED", "COMPLETED"].includes(booking.status)) return new Response("Bulunamadı.", { status: 404 });

  const event = await lessonCalendarEvent(booking, viewer, shortName(booking.teacher.user));
  return new Response(icsFile(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ders-${booking.code}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

import { icsFile } from "@/lib/calendar";
import { fullName } from "@/lib/text";
import { db } from "@/server/db";
import { lessonCalendarEvent } from "@/server/lesson-calendar";
import { ownBooking } from "@/server/mobile/bookings";
import { ApiError } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Onaylı dersin .ics takvim dosyası (telefon takvimine eklemek için). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  const own = await ownBooking(user, params.id);
  if (!["CONFIRMED", "COMPLETED"].includes(own.status)) throw new ApiError(409, "NOT_CONFIRMED", "Takvime yalnızca onaylanmış dersler eklenebilir.");
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: own.id },
    include: { district: { include: { city: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
  });
  const event = await lessonCalendarEvent(booking, user.role, fullName(booking.teacher.user));
  return new Response(icsFile(event), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="ders-${booking.code}.ics"`, "Cache-Control": "no-store" },
  });
});

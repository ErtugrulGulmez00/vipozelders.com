import { z } from "zod";
import { cancelByStudent, cancelByTeacher } from "@/server/bookings";
import { bookingDetail, ownBooking, requireReason } from "@/server/mobile/bookings";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** İptal. Veli için iade tutarı GET ayrıntısındaki actions.cancelPreview'de önceden gösterilir; öğretmen iptalinde tam iade. */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  const { reason } = await readBody(request, z.object({ reason: z.string().optional() }));
  const booking = await ownBooking(user, params.id);
  if (user.role === "TEACHER") {
    await cancelByTeacher(booking.id, user.id, requireReason(reason, 5, "Öğrenciye iletilecek iptal gerekçesini yazın.").slice(0, 300));
  } else {
    await cancelByStudent(booking.id, user.id, requireReason(reason, 3, "Lütfen kısa bir iptal gerekçesi yazın.").slice(0, 300));
  }
  return json(await bookingDetail(user, booking.id));
});

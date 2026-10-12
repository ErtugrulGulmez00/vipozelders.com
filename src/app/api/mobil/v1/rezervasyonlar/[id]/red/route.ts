import { z } from "zod";
import { rejectBooking } from "@/server/bookings";
import { requireRole } from "@/server/mobile/auth";
import { bookingDetail, ownBooking, requireReason } from "@/server/mobile/bookings";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğretmen talebi reddeder; veliye ücretin tamamı otomatik iade edilir. */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "TEACHER");
  const { reason } = await readBody(request, z.object({ reason: z.string().optional() }));
  const booking = await ownBooking(user, params.id);
  await rejectBooking(booking.id, user.id, requireReason(reason, 3, "Öğrenciye iletilecek kısa bir gerekçe yazın.").slice(0, 300));
  return json(await bookingDetail(user, booking.id));
});

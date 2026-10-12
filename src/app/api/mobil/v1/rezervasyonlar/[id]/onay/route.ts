import { approveBooking } from "@/server/bookings";
import { requireRole } from "@/server/mobile/auth";
import { bookingDetail, ownBooking } from "@/server/mobile/bookings";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğretmen talebi onaylar: saat dolar, veliye bildirim gider, online derste sanal sınıf hazırlanır. */
export const POST = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "TEACHER");
  const booking = await ownBooking(user, params.id);
  await approveBooking(booking.id, user.id);
  return json(await bookingDetail(user, booking.id));
});

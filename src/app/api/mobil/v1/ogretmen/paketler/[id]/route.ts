import { approveBooking, BookingError } from "@/server/bookings";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğretmen: düzenli dersin (paketin) bekleyen tüm taleplerini tek seferde onaylar → { approved, failed }. */
export const POST = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "TEACHER");
  const pending = await db.booking.findMany({ where: { packageId: params.id, teacherId: user.id, status: "PENDING_APPROVAL" }, select: { id: true } });
  let approved = 0;
  for (const b of pending) {
    try {
      await approveBooking(b.id, user.id);
      approved++;
    } catch (error) {
      if (!(error instanceof BookingError)) throw error;
    }
  }
  return json({ approved, failed: pending.length - approved });
});

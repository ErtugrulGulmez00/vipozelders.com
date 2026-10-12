import { z } from "zod";
import { openDispute } from "@/server/bookings";
import { requireRole } from "@/server/mobile/auth";
import { bookingDetail, ownBooking, requireReason } from "@/server/mobile/bookings";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Ders sonrası sorun bildirimi (itiraz süresi içinde); inceleme bitene kadar öğretmene ödeme yapılmaz. */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const { reason } = await readBody(request, z.object({ reason: z.string().optional() }));
  const booking = await ownBooking(user, params.id);
  await openDispute(booking.id, user.id, requireReason(reason, 10, "Yaşadığınız sorunu biraz daha ayrıntılı anlatın (en az 10 karakter).").slice(0, 1000));
  return json(await bookingDetail(user, booking.id));
});

import { startCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { clientIp, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { ownBooking } from "@/server/mobile/bookings";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Ödeme başarısız olduysa veya yarıda kaldıysa (saat hâlâ ayrılmışken) yeniden dene. */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const booking = await ownBooking(user, params.id);
  const redirectUrl = await startCheckout(booking.id, user.id, clientIp(request) ?? "127.0.0.1");
  const { holdExpiresAt } = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { holdExpiresAt: true } });
  return json({ payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix(), expiresAt: holdExpiresAt } });
});

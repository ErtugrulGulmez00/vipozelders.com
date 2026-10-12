import { z } from "zod";
import { requireRole } from "@/server/mobile/auth";
import { bookingDetail, ownBooking } from "@/server/mobile/bookings";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { upsertReview } from "@/server/reviews";

/** Puan ve yorum (öğretmen başına bir değerlendirme; tekrar gönderilirse güncellenir). */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  const input = await readBody(request, z.object({ rating: z.number().int().min(1, "1 ile 5 arasında puan verin.").max(5, "1 ile 5 arasında puan verin."), comment: z.string().max(1500).optional() }));
  const booking = await ownBooking(user, params.id);
  await upsertReview(user.id, booking.teacherId, input.rating, input.comment ?? "");
  return json(await bookingDetail(user, booking.id));
});

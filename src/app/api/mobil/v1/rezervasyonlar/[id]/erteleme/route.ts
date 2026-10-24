import { z } from "zod";
import { bookingDetail, ownBooking } from "@/server/mobile/bookings";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { cancelRescheduleRequest, requestReschedule, respondReschedule } from "@/server/reschedule";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request"), newStartAt: z.iso.datetime({ offset: true, error: "Geçersiz saat." }), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("accept"), requestId: z.string() }),
  z.object({ action: z.literal("decline"), requestId: z.string() }),
  z.object({ action: z.literal("cancel"), requestId: z.string() }),
]);

/**
 * Erteleme (onaylı ders): { action: "request", newStartAt, note? } yeni saat önerir; karşı taraf
 * { action: "accept" | "decline", requestId } ile yanıtlar; öneren { action: "cancel", requestId } ile geri çeker.
 * Yanıt: güncel ders ayrıntısı.
 */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  const booking = await ownBooking(user, params.id);
  const input = await readBody(request, schema);
  if (input.action === "request") await requestReschedule(booking.id, user.id, new Date(input.newStartAt), input.note ?? null);
  if (input.action === "accept") await respondReschedule(input.requestId, user.id, true);
  if (input.action === "decline") await respondReschedule(input.requestId, user.id, false);
  if (input.action === "cancel") await cancelRescheduleRequest(input.requestId, user.id);
  return json(await bookingDetail(user, booking.id));
});

import { z } from "zod";
import { createBookingHold, startCheckout } from "@/server/bookings";
import { maintenanceState } from "@/server/maintenance";
import { clientIp, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { bookingDetail, listBookings } from "@/server/mobile/bookings";
import { ApiError, json, pageParam, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Randevular: ?kapsam=yaklasan|gecmis|iptal (veli) · yaklasan|talepler|gecmis (öğretmen) &sayfa=1 */
export const GET = withUser(async ({ request, user }) => {
  const url = new URL(request.url);
  return json(await listBookings(user, url.searchParams.get("kapsam") ?? "yaklasan", pageParam(url)));
});

const createSchema = z.object({
  offeringId: z.string().min(1, "Ders seçin."),
  startAt: z.iso.datetime({ offset: true, error: "Geçersiz saat." }),
  durationMinutes: z.number().int(),
  mode: z.enum(["ONLINE", "IN_PERSON"]),
  learnerName: z.string().trim().min(2, "Dersin kimin için olduğunu yazın.").max(60),
  learnerGrade: z.string().trim().max(40).optional(),
  inPersonPlace: z.enum(["STUDENT_HOME", "TEACHER_PLACE"]).optional(),
  districtId: z.number().int().optional(),
  address: z.string().trim().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
  // Ücretsiz 15 dk tanışma görüşmesi: ödeme yok, doğrudan öğretmen onayına düşer (consent gerekmez)
  intro: z.boolean().optional(),
  consent: z.boolean().optional(),
});

/**
 * Saat ayırır ve ödemeyi başlatır. Uygulama payment.url adresini WebView'da açar; WebView
 * payment.returnUrlPrefix ile başlayan bir adrese gidince kapatılıp randevu durumu sorgulanır.
 */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  if ((await maintenanceState()).on) throw new ApiError(503, "MAINTENANCE", "Site şu an bakımda; randevu alma birazdan yeniden açılacak.");
  const input = await readBody(request, createSchema);
  const intro = Boolean(input.intro);
  if (!intro && input.consent !== true) {
    throw new ApiError(422, "VALIDATION", "Lütfen işaretli alanları kontrol edin.", { consent: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." });
  }
  const booking = await createBookingHold({
    studentId: user.id,
    offeringId: input.offeringId,
    startAt: new Date(input.startAt),
    durationMinutes: input.durationMinutes,
    mode: input.mode,
    learnerName: input.learnerName,
    learnerGrade: input.learnerGrade,
    inPersonPlace: input.mode === "IN_PERSON" ? (input.inPersonPlace ?? null) : null,
    districtId: input.districtId ?? null,
    address: input.address ?? null,
    studentNote: input.note ?? null,
    intro,
  });
  if (intro) return json({ booking: await bookingDetail(user, booking.id), payment: null }, 201);
  const redirectUrl = await startCheckout(booking.id, user.id, clientIp(request) ?? "127.0.0.1");
  return json(
    {
      booking: await bookingDetail(user, booking.id),
      payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix(), expiresAt: booking.holdExpiresAt },
    },
    201,
  );
});

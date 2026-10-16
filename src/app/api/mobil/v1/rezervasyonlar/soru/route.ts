import { z } from "zod";
import { zodFieldErrors } from "@/lib/action-state";
import { startCheckout } from "@/server/bookings";
import { maintenanceState } from "@/server/maintenance";
import { clientIp, paymentLink, paymentReturnPrefix, requireRole } from "@/server/mobile/auth";
import { bookingDetail } from "@/server/mobile/bookings";
import { ApiError, json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { createQuestionHold } from "@/server/question-bookings";

const schema = z.object({
  offeringId: z.string().min(1, "Ders seçin."),
  learnerName: z.string().trim().min(2, "Sorunun kimin için olduğunu yazın.").max(60),
  learnerGrade: z.string().trim().max(40).optional(),
  note: z.string().trim().max(1000).optional(),
  consent: z.enum(["true", "1", "on"], { error: "Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın." }),
});

/**
 * Fotoğrafla soru (multipart/form-data: image, offeringId, learnerName, learnerGrade?, note?, consent=true).
 * Soru kaydedilir ve ödeme başlar; yanıt POST /rezervasyonlar ile aynıdır ({booking, payment}).
 */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "STUDENT");
  if ((await maintenanceState()).on) throw new ApiError(503, "MAINTENANCE", "Site şu an bakımda; soru gönderme birazdan yeniden açılacak.");
  const form = await request.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_REQUEST", "multipart/form-data bekleniyor.");
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string" && v !== ""));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "VALIDATION", "Lütfen işaretli alanları kontrol edin.", zodFieldErrors(parsed.error.issues));
  const image = form.get("image");
  if (!(image instanceof File) || image.size === 0) throw new ApiError(422, "VALIDATION", "Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });

  const input = parsed.data;
  const booking = await createQuestionHold({ studentId: user.id, offeringId: input.offeringId, learnerName: input.learnerName, learnerGrade: input.learnerGrade, note: input.note, image });
  const redirectUrl = await startCheckout(booking.id, user.id, clientIp(request) ?? "127.0.0.1");
  return json(
    {
      booking: await bookingDetail(user, booking.id),
      payment: { url: await paymentLink(user.id, redirectUrl), returnUrlPrefix: paymentReturnPrefix(), expiresAt: booking.holdExpiresAt },
    },
    201,
  );
});

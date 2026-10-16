import { bookingDetail, ownBooking } from "@/server/mobile/bookings";
import { ApiError, json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { addQuestionMessage } from "@/server/question-bookings";

const file = (form: FormData, key: string) => {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

/**
 * Fotoğrafla soru yazışmasına mesaj ekler (multipart/form-data: body?, image?, video? (yalnızca öğretmen),
 * isSolution=true (öğretmenin çözümü; soru "çözüldü" olur ve veliye bildirim gider)). Yanıt: ders ayrıntısı.
 */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  const booking = await ownBooking(user, params.id);
  const form = await request.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_REQUEST", "multipart/form-data bekleniyor.");
  const solution = String(form.get("isSolution") ?? "");
  await addQuestionMessage(booking.id, user, {
    body: String(form.get("body") ?? "").slice(0, 4000),
    image: file(form, "image"),
    video: file(form, "video"),
    isSolution: ["true", "1", "on"].includes(solution),
  });
  return json(await bookingDetail(user, booking.id));
});

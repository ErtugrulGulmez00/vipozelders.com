import { bookingDetail } from "@/server/mobile/bookings";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Ders ayrıntısı; actions alanı o an yapılabilecek işlemleri söyler (ödeme, katılma, iptal, değerlendirme…). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => json(await bookingDetail(user, params.id)));

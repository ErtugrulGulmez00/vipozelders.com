import type { BookingStatus, Prisma } from "@/generated/prisma/client";
import { BOOKING_STATUS } from "@/lib/labels";

/** Yönetim → Randevular listesindeki arama ve durum filtresi (liste ve CSV çıktısı aynı filtreyi kullanır). */
export function adminBookingWhere(q: string, status: string): Prisma.BookingWhereInput {
  return {
    ...(status && status in BOOKING_STATUS ? { status: status as BookingStatus } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q.toUpperCase() } },
            { learnerName: { contains: q, mode: "insensitive" } },
            { student: { email: { contains: q.toLowerCase() } } },
            { student: { lastName: { contains: q, mode: "insensitive" } } },
            { teacher: { user: { lastName: { contains: q, mode: "insensitive" } } } },
            { teacher: { user: { firstName: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
}

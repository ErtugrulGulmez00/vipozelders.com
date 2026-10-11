import type { Prisma } from "@/generated/prisma/client";
import { shortName } from "@/lib/text";
import { db } from "./db";

const bookingInclude = {
  teacher: { select: { slug: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.BookingInclude;

export async function studentBookings(studentId: string, where: Prisma.BookingWhereInput, orderBy: Prisma.BookingOrderByWithRelationInput = { startAt: "asc" }, take = 50) {
  const rows = await db.booking.findMany({ where: { studentId, ...where }, include: bookingInclude, orderBy, take });
  return rows.map((b) => ({ ...b, counterpart: shortName(b.teacher.user) }));
}

export const UPCOMING: Prisma.BookingWhereInput = { status: { in: ["PENDING_APPROVAL", "CONFIRMED"] } };
export const CANCELLED_STATUSES = ["REJECTED", "EXPIRED", "CANCELLED_BY_STUDENT", "CANCELLED_BY_TEACHER", "CANCELLED_BY_ADMIN", "PAYMENT_FAILED"] as const;
export const PAST_STATUSES = ["COMPLETED", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER", "DISPUTED"] as const;

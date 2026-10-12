import type { BookingStatus, Prisma } from "@/generated/prisma/client";
import { PAYMENT_STATUS, REFUND_STATUS } from "@/lib/labels";
import { previewStudentCancellation } from "../bookings";
import { db } from "../db";
import { reviewEligibility } from "../reviews";
import { loadSettings } from "../settings";
import { CANCELLED_STATUSES, PAST_STATUSES } from "../student-queries";
import type { MobileUser } from "./auth";
import { ApiError, notFound } from "./http";
import { bookingSummaryJson, statusJson } from "./serialize";

const PEOPLE = {
  teacher: { select: { slug: true, photoKey: true, user: { select: { firstName: true, lastName: true } } } },
  student: { select: { firstName: true, lastName: true } },
} satisfies Prisma.BookingInclude;

const PAGE_SIZE = 20;
const CLASSROOM_CLOSE_AFTER_MINUTES = 15;
const CONFIRMED_OR_LATER: BookingStatus[] = ["CONFIRMED", "COMPLETED", "NO_SHOW_STUDENT", "DISPUTED"];
const TEACHER_PAST: BookingStatus[] = ["COMPLETED", "NO_SHOW_STUDENT", "NO_SHOW_TEACHER", "DISPUTED", "CANCELLED_BY_STUDENT", "CANCELLED_BY_TEACHER", "CANCELLED_BY_ADMIN"];

export const BOOKING_SCOPES = { STUDENT: ["yaklasan", "gecmis", "iptal"], TEACHER: ["yaklasan", "talepler", "gecmis"] } as const;

/** Web panellerindeki sekmelerle aynı gruplama. */
function scopeWhere(user: MobileUser, scope: string, now: Date): { where: Prisma.BookingWhereInput; orderBy: Prisma.BookingOrderByWithRelationInput } {
  if (user.role === "TEACHER") {
    if (scope === "talepler") return { where: { teacherId: user.id, status: "PENDING_APPROVAL" }, orderBy: { approvalDeadline: "asc" } };
    if (scope === "gecmis") return { where: { teacherId: user.id, status: { in: TEACHER_PAST } }, orderBy: { startAt: "desc" } };
    return { where: { teacherId: user.id, status: "CONFIRMED", endAt: { gt: now } }, orderBy: { startAt: "asc" } };
  }
  if (scope === "gecmis") return { where: { studentId: user.id, status: { in: [...PAST_STATUSES] } }, orderBy: { startAt: "desc" } };
  if (scope === "iptal") return { where: { studentId: user.id, status: { in: [...CANCELLED_STATUSES] } }, orderBy: { startAt: "desc" } };
  return {
    where: {
      studentId: user.id,
      OR: [
        { status: { in: ["PENDING_APPROVAL", "CONFIRMED"] }, endAt: { gt: now } },
        { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
      ],
    },
    orderBy: { startAt: "asc" },
  };
}

export async function listBookings(user: MobileUser, scope: string, page: number, now = new Date()) {
  const allowed: readonly string[] = BOOKING_SCOPES[user.role];
  const resolved = allowed.includes(scope) ? scope : "yaklasan";
  const { where, orderBy } = scopeWhere(user, resolved, now);
  const rows = await db.booking.findMany({ where, orderBy, include: PEOPLE, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1 });
  return {
    scope: resolved,
    items: rows.slice(0, PAGE_SIZE).map((b) => bookingSummaryJson(b, user.role)),
    nextPage: rows.length > PAGE_SIZE ? page + 1 : null,
  };
}

/** Randevuyu yalnızca tarafı olan kullanıcıya verir. */
export async function ownBooking(user: MobileUser, bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || (user.role === "STUDENT" ? booking.studentId : booking.teacherId) !== user.id) throw notFound("Randevu bulunamadı.");
  return booking;
}

/** Ders ayrıntısı ve kullanıcının o an yapabileceği işlemler (uygulama düğmeleri buna göre gösterir). */
export async function bookingDetail(user: MobileUser, bookingId: string, now = new Date()) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      ...PEOPLE,
      student: { select: { firstName: true, lastName: true, phone: true } },
      district: { include: { city: true } },
      payments: { orderBy: { createdAt: "asc" }, include: { refunds: { orderBy: { createdAt: "asc" } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  const isStudent = user.role === "STUDENT";
  if (!booking || (isStudent ? booking.studentId : booking.teacherId) !== user.id) throw notFound("Randevu bulunamadı.");

  const settings = await loadSettings();
  const online = booking.mode === "ONLINE";
  const opensAt = new Date(booking.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
  const closesAt = new Date(booking.endAt.getTime() + CLASSROOM_CLOSE_AFTER_MINUTES * 60_000);
  const classroomOpen = online && booking.status === "CONFIRMED" && now >= opensAt && now <= closesAt;
  const revealContact = isStudent || CONFIRMED_OR_LATER.includes(booking.status);
  const location =
    booking.mode === "IN_PERSON" && revealContact
      ? { place: booking.inPersonPlace, address: booking.address, districtName: booking.district?.name ?? null, cityName: booking.district?.city.name ?? null }
      : null;

  const base = {
    ...bookingSummaryJson(booking, user.role),
    learnerGrade: booking.learnerGrade,
    inPersonPlace: booking.inPersonPlace,
    note: booking.studentNote,
    price: booking.price,
    refundedAmount: booking.refundedAmount,
    holdExpiresAt: booking.status === "PENDING_PAYMENT" ? booking.holdExpiresAt : null,
    rejectionReason: booking.rejectionReason,
    cancelReason: booking.cancelReason,
    disputeReason: booking.disputeReason,
    location,
    classroom: online ? { opensAt, closesAt, open: classroomOpen } : null,
    events: booking.events.map((e) => ({ ...statusJson(e.toStatus), note: e.note, createdAt: e.createdAt })),
  };

  if (isStudent) {
    const [cancellation, eligibility] = await Promise.all([previewStudentCancellation(booking, now), reviewEligibility(user.id, booking.teacherId, now)]);
    const holdValid = booking.status === "PENDING_PAYMENT" && Boolean(booking.holdExpiresAt && booking.holdExpiresAt > now);
    return {
      ...base,
      payments: booking.payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        amount: p.amount,
        refundedAmount: p.refundedAmount,
        status: p.status,
        statusLabel: PAYMENT_STATUS[p.status]?.label ?? p.status,
        failureReason: p.failureReason,
        createdAt: p.createdAt,
        refunds: p.refunds.map((r) => ({ amount: r.amount, status: r.status, statusLabel: REFUND_STATUS[r.status]?.label ?? r.status, reason: r.reason, createdAt: r.createdAt, processedAt: r.processedAt })),
      })),
      // Değerlendirme öğretmen başına birdir; sonraki derslerde de aynı yorum güncellenir.
      review: eligibility.existing ? { rating: eligibility.existing.rating, comment: eligibility.existing.comment, teacherReply: eligibility.existing.teacherReply } : null,
      actions: {
        canPay: holdValid,
        canJoin: classroomOpen,
        canCancel: cancellation.allowed && booking.status !== "PENDING_PAYMENT",
        cancelPreview: { refundAmount: cancellation.refundAmount, refundPercent: cancellation.refundPercent, reason: cancellation.reason ?? null },
        canReview: eligibility.eligible && booking.status === "COMPLETED",
        canDispute: ["COMPLETED", "NO_SHOW_STUDENT"].includes(booking.status) && !booking.earningsReleasedAt && Boolean(booking.earningsReleaseAt && booking.earningsReleaseAt > now),
      },
    };
  }

  return {
    ...base,
    parent: revealContact ? { name: `${booking.student.firstName} ${booking.student.lastName}`, phone: booking.student.phone } : { name: booking.student.firstName, phone: null },
    teacherAmount: booking.teacherAmount,
    actions: {
      canJoin: classroomOpen,
      canApprove: booking.status === "PENDING_APPROVAL",
      canReject: booking.status === "PENDING_APPROVAL",
      canCancel: booking.status === "CONFIRMED" && booking.startAt > now,
    },
  };
}

export function requireReason(reason: string | undefined, min: number, message: string): string {
  const text = (reason ?? "").trim();
  if (text.length < min) throw new ApiError(422, "VALIDATION", message, { reason: message });
  return text;
}

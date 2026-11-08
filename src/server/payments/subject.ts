import type { Booking, GroupCourse, GroupEnrollment, LessonPackage } from "@/generated/prisma/client";
import { formatLessonRange } from "@/lib/dates";

/** Ödemenin neye ait olduğu: ders randevusu, grup dersi ya da ders paketi. Ödeme ve sonuç sayfaları bunu gösterir. */
export type PaymentSubject = {
  kind: "booking" | "group" | "package";
  ownerId: string;
  /** /odeme/sonuc/[id] sayfasının kimliği */
  resultId: string;
  code: string;
  title: string;
  detail: string;
  holdExpiresAt: Date | null;
};

export function paymentSubject(payment: {
  booking: Booking | null;
  groupEnrollment?: (GroupEnrollment & { course: GroupCourse }) | null;
  package?: LessonPackage | null;
}): PaymentSubject | null {
  const { booking, groupEnrollment, package: lessonPackage } = payment;
  if (booking) {
    return {
      kind: "booking",
      ownerId: booking.studentId,
      resultId: booking.id,
      code: booking.code,
      title: `${booking.levelName} ${booking.subjectName} · ${booking.serviceName}`,
      detail: formatLessonRange(booking.startAt, booking.endAt),
      holdExpiresAt: booking.holdExpiresAt,
    };
  }
  if (groupEnrollment) {
    return {
      kind: "group",
      ownerId: groupEnrollment.studentId,
      resultId: groupEnrollment.id,
      code: groupEnrollment.code,
      title: `Grup dersi: ${groupEnrollment.course.title}`,
      detail: `${groupEnrollment.course.levelName} ${groupEnrollment.course.subjectName}`,
      holdExpiresAt: groupEnrollment.holdExpiresAt,
    };
  }
  if (lessonPackage) {
    return {
      kind: "package",
      ownerId: lessonPackage.studentId,
      resultId: lessonPackage.id,
      code: lessonPackage.code,
      title: `${lessonPackage.levelName} ${lessonPackage.subjectName} · ${lessonPackage.lessonCount} derslik paket`,
      detail: lessonPackage.recurringStartAt ? `Her hafta, ${lessonPackage.durationMinutes} dk` : `${lessonPackage.durationMinutes} dakikalık dersler`,
      holdExpiresAt: null,
    };
  }
  return null;
}

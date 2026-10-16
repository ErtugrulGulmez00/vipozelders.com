import type { Booking, Notification } from "@/generated/prisma/client";
import { BOOKING_STATUS } from "@/lib/labels";
import { fullName, shortName } from "@/lib/text";
import { appUrl } from "../email";
import { lessonPrice } from "../pricing";
import { uploadUrl } from "../storage";
import type { PublicTeacher, TeacherCard } from "../teachers";

// Uygulamaya giden JSON biçimleri. Yalnızca açıkça listelenen alanlar gönderilir
// (ör. öğretmenin IBAN'ı, komisyon oranı veya iç notlar hiçbir zaman çıkmaz).
// Tarihler ISO 8601 (UTC), tutarlar kuruş cinsinden tam sayıdır.

export function absoluteUpload(key: string | null | undefined): string | null {
  const path = uploadUrl(key);
  return path ? appUrl(path) : null;
}

export function statusJson(status: string) {
  return { status, statusLabel: BOOKING_STATUS[status]?.label ?? status };
}

export function teacherCardJson(card: TeacherCard) {
  return {
    userId: card.userId,
    slug: card.slug,
    name: card.name,
    headline: card.headline,
    photoUrl: card.photoUrl ? appUrl(card.photoUrl) : null,
    ratingAvg: card.ratingAvg,
    ratingCount: card.ratingCount,
    completedLessons: card.completedLessons,
    experienceYears: card.experienceYears,
    cityName: card.cityName,
    offersOnline: card.offersOnline,
    offersInPerson: card.offersInPerson,
    verified: card.verified,
    featured: card.featured,
    minHourlyPrice: card.minHourlyPrice,
    subjects: card.subjects,
    avgResponseMinutes: card.avgResponseMinutes,
  };
}

export function teacherProfileJson(teacher: PublicTeacher) {
  return {
    userId: teacher.userId,
    slug: teacher.slug,
    name: fullName(teacher.user),
    headline: teacher.headline,
    bio: teacher.bio,
    photoUrl: absoluteUpload(teacher.photoKey),
    videoUrl: teacher.videoUrl,
    education: teacher.education,
    experienceYears: teacher.experienceYears,
    gender: teacher.gender,
    verified: teacher.verificationStatus === "VERIFIED",
    ratingAvg: teacher.ratingAvg,
    ratingCount: teacher.ratingCount,
    completedLessons: teacher.completedLessons,
    avgResponseMinutes: teacher.avgResponseMinutes,
    offersOnline: teacher.offersOnline,
    offersInPerson: teacher.offersInPerson,
    inPersonAtStudentHome: teacher.inPersonAtStudentHome,
    inPersonAtTeacherPlace: teacher.inPersonAtTeacherPlace,
    city: teacher.city ? { id: teacher.city.id, name: teacher.city.name } : null,
    district: teacher.district ? { id: teacher.district.id, name: teacher.district.name } : null,
    serviceDistricts: teacher.serviceDistricts.map((d) => ({ id: d.district.id, name: d.district.name, cityId: d.district.cityId, cityName: d.district.city.name })),
    offerings: teacher.offerings.map((o) => ({
      id: o.id,
      level: { id: o.level.id, name: o.level.name, slug: o.level.slug },
      subject: { id: o.subject.id, name: o.subject.name, slug: o.subject.slug },
      service: { id: o.serviceType.id, name: o.serviceType.name, slug: o.serviceType.slug },
      hourlyPrice: o.hourlyPrice,
      durations: o.durations.map((minutes) => ({ minutes, price: lessonPrice(o.hourlyPrice, minutes) })),
      // Fotoğrafla soru kabul ediliyorsa soru başı ücret (kuruş), yoksa null
      questionPrice: o.questionPrice ?? null,
    })),
    reviews: teacher.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      studentName: shortName(r.student),
      lesson: `${r.booking.levelName} ${r.booking.subjectName}`,
      teacherReply: r.teacherReply,
      teacherRepliedAt: r.teacherRepliedAt,
      createdAt: r.createdAt,
    })),
  };
}

/** Bildirimin uygulamada açacağı ekran (web bağlantısından çıkarılır). */
export function notificationTarget(link: string | null): { screen: string; id?: string } | null {
  if (!link) return null;
  const booking = /^\/(?:hesabim\/derslerim|ogretmen-paneli\/dersler|odeme\/sonuc)\/([a-z0-9]+)/i.exec(link);
  if (booking) return { screen: "booking", id: booking[1] };
  if (link.startsWith("/ogretmen-paneli/talepler")) return { screen: "requests" };
  if (link.startsWith("/ogretmen-paneli/yorumlar")) return { screen: "reviews" };
  if (link.startsWith("/ogretmen-paneli/kazanclar")) return { screen: "earnings" };
  const teacher = /^\/ogretmen\/([a-z0-9-]+)/i.exec(link);
  if (teacher) return { screen: "teacher", id: teacher[1] };
  // Kurum (veli portalı) bildirimleri: devamsızlık, deneme sonucu, ödeme, duyuru
  const center = /^\/hesabim\/kurum\/([a-z0-9]+)/i.exec(link);
  if (center) return { screen: "centerStudent", id: center[1] };
  if (link.startsWith("/hesabim/kurum")) return { screen: "center" };
  return null;
}

export function notificationJson(n: Notification) {
  return { id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, target: notificationTarget(n.link), readAt: n.readAt, createdAt: n.createdAt };
}

type BookingWithPeople = Booking & {
  teacher: { slug: string; photoKey: string | null; user: { firstName: string; lastName: string } };
  student: { firstName: string; lastName: string };
};

/** Liste kartı: veli öğretmeni, öğretmen öğrenciyi görür; öğretmene kendi kazancı gösterilir. */
export function bookingSummaryJson(booking: BookingWithPeople, viewer: "STUDENT" | "TEACHER") {
  return {
    id: booking.id,
    code: booking.code,
    ...statusJson(booking.status),
    startAt: booking.startAt,
    endAt: booking.endAt,
    durationMinutes: booking.durationMinutes,
    levelName: booking.levelName,
    subjectName: booking.subjectName,
    serviceName: booking.serviceName,
    mode: booking.mode,
    learnerName: booking.learnerName,
    amount: viewer === "TEACHER" ? booking.teacherAmount : booking.price,
    approvalDeadline: booking.status === "PENDING_APPROVAL" ? booking.approvalDeadline : null,
    isTest: booking.isTest,
    counterpart:
      viewer === "STUDENT"
        ? { name: fullName(booking.teacher.user), photoUrl: absoluteUpload(booking.teacher.photoKey), teacherSlug: booking.teacher.slug }
        : { name: `${booking.student.firstName} ${booking.student.lastName}`, photoUrl: null, teacherSlug: null },
  };
}

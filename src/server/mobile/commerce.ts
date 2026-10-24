import type { GroupCourse, GroupEnrollment, GroupSession, LessonPackage, QuestionSubscription } from "@/generated/prisma/client";
import { BOOKING_STATUS, GROUP_COURSE_STATUS, GROUP_ENROLLMENT_STATUS, GROUP_SESSION_STATUS, SUBSCRIPTION_STATUS } from "@/lib/labels";
import { fullName } from "@/lib/text";
import { packageLessonsLeft } from "../bookings";
import { db } from "../db";
import { seatsTaken } from "../groups";
import { packageRefundPreview, parsePackageDiscounts } from "../packages";
import { isRunning, publicPlans, questionsToday } from "../subscriptions";
import { loadSettings } from "../settings";
import { notFound } from "./http";
import { absoluteUpload } from "./serialize";

// Paket ders, aylık soru aboneliği ve grup dersinin mobil biçimleri. İş kuralları packages.ts, subscriptions.ts,
// groups.ts'te.

type TeacherRef = { slug: string; photoKey: string | null; user: { firstName: string; lastName: string } };
const teacherJson = (t: TeacherRef) => ({ name: fullName(t.user), slug: t.slug, photoUrl: absoluteUpload(t.photoKey) });
const TEACHER_SELECT = { select: { slug: true, photoKey: true, user: { select: { firstName: true, lastName: true } } } } as const;

const PACKAGE_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Ödeme bekleniyor",
  PAID: "Aktif",
  CLOSED: "Kapandı",
  FAILED: "Ödeme başarısız",
  EXPIRED: "Ödenmedi",
};

// ---------------------------------------------------------------------------
// Öğretmen profilindeki teklifler
// ---------------------------------------------------------------------------

/** Profilde: paket indirimleri, aylık soru abonelikleri, kayıt açık grup dersleri ve izleyicinin bu öğretmendeki paketleri. */
export async function teacherOffersJson(teacher: { userId: string; packageDiscounts: string }, viewerId: string | null, now = new Date()) {
  const settings = await loadSettings();
  const [plans, courses, packages] = await Promise.all([
    publicPlans(teacher.userId),
    settings.groupsEnabled
      ? db.groupCourse.findMany({
          where: { teacherId: teacher.userId, status: "OPEN", isPublic: true, enrollDeadline: { gt: now } },
          orderBy: { enrollDeadline: "asc" },
          include: { sessions: { orderBy: { index: "asc" }, select: { startAt: true, endAt: true } } },
          take: 10,
        })
      : Promise.resolve([]),
    viewerId ? db.lessonPackage.findMany({ where: { studentId: viewerId, teacherId: teacher.userId, status: "PAID", expiresAt: { gt: now } }, orderBy: { paidAt: "asc" } }) : Promise.resolve([]),
  ]);
  const myPackages = (await Promise.all(packages.map(async (p) => ({ p, left: await packageLessonsLeft(db, p) })))).filter((x) => x.left > 0);
  return {
    packageOffers: settings.packagesEnabled ? parsePackageDiscounts(teacher.packageDiscounts, settings.packageMaxLessons, settings.packageMaxDiscountPercent) : [],
    questionPlans: plans.map((p) => ({
      id: p.id,
      levelName: p.level.name,
      subjectName: p.subject.name,
      price: p.price,
      dailyLimit: p.dailyLimit,
      answerHours: p.answerHours,
      days: settings.subscriptionDays,
      description: p.description,
    })),
    groupCourses: await Promise.all(courses.map((c) => groupCourseSummary(c, now))),
    // "Paketimden kullan": kalan dersi olan paketler (aynı ders ve sürede kullanılır)
    myPackages: myPackages.map(({ p, left }) => ({ id: p.id, code: p.code, offeringId: p.offeringId, durationMinutes: p.durationMinutes, levelName: p.levelName, subjectName: p.subjectName, left, expiresAt: p.expiresAt })),
  };
}

// ---------------------------------------------------------------------------
// Paket ders
// ---------------------------------------------------------------------------

export function packageSummary(p: LessonPackage & { teacher: TeacherRef }) {
  return {
    id: p.id,
    code: p.code,
    teacher: teacherJson(p.teacher),
    offeringId: p.offeringId,
    levelName: p.levelName,
    subjectName: p.subjectName,
    serviceName: p.serviceName,
    durationMinutes: p.durationMinutes,
    lessonCount: p.lessonCount,
    listUnitPrice: p.listUnitPrice,
    unitPrice: p.unitPrice,
    discountPercent: p.discountPercent,
    price: p.price,
    refundedAmount: p.refundedAmount,
    status: p.status,
    statusLabel: PACKAGE_STATUS[p.status] ?? p.status,
    recurring: Boolean(p.recurringStartAt),
    paidAt: p.paidAt,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  };
}

export async function packagesJson(studentId: string, now = new Date()) {
  const rows = await db.lessonPackage.findMany({
    where: { studentId, status: { in: ["PAID", "CLOSED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { teacher: TEACHER_SELECT, bookings: { orderBy: { startAt: "asc" }, select: { id: true, startAt: true, endAt: true, status: true, price: true, refundedAmount: true } } },
  });
  return {
    items: await Promise.all(
      rows.map(async (p) => {
        const [left, refund] = await Promise.all([packageLessonsLeft(db, p), packageRefundPreview(p)]);
        return {
          ...packageSummary(p),
          active: p.status === "PAID" && (!p.expiresAt || p.expiresAt > now),
          left,
          refund: refund.allowed ? { allowed: true, amount: refund.amount, reason: null } : { allowed: false, amount: 0, reason: refund.reason },
          bookings: p.bookings.map((b) => ({
            id: b.id,
            startAt: b.startAt,
            endAt: b.endAt,
            status: b.status,
            statusLabel: b.refundedAmount >= b.price ? "Pakete döndü" : (BOOKING_STATUS[b.status]?.label ?? b.status),
          })),
        };
      }),
    ),
  };
}

export async function packageStatusJson(studentId: string, id: string) {
  const p = await db.lessonPackage.findUnique({ where: { id }, include: { teacher: TEACHER_SELECT, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!p || p.studentId !== studentId) throw notFound("Paket bulunamadı.");
  const last = p.payments[0];
  return { ...packageSummary(p), left: p.status === "PAID" ? await packageLessonsLeft(db, p) : 0, payment: last ? { status: last.status, failureReason: last.failureReason } : null };
}

// ---------------------------------------------------------------------------
// Aylık soru aboneliği
// ---------------------------------------------------------------------------

export async function subscriptionJson(s: QuestionSubscription & { teacher: TeacherRef }, now = new Date()) {
  const running = isRunning(s, now);
  return {
    id: s.id,
    code: s.code,
    planId: s.planId,
    teacher: teacherJson(s.teacher),
    levelName: s.levelName,
    subjectName: s.subjectName,
    price: s.price,
    discountAmount: s.discountAmount,
    dailyLimit: s.dailyLimit,
    answerHours: s.answerHours,
    days: s.days,
    status: s.status,
    statusLabel: running ? "Aktif" : s.status === "ACTIVE" && s.startsAt && s.startsAt > now ? "Sıradaki dönem" : (SUBSCRIPTION_STATUS[s.status]?.label ?? s.status),
    running,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    paidAt: s.paidAt,
    refundedAmount: s.refundedAmount,
    usedToday: running ? await questionsToday(s.id, now) : 0,
  };
}

export async function subscriptionsJson(studentId: string, now = new Date()) {
  const rows = await db.questionSubscription.findMany({
    where: { studentId, status: { in: ["ACTIVE", "ENDED", "CANCELLED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { teacher: TEACHER_SELECT },
  });
  const items = await Promise.all(rows.map((s) => subscriptionJson(s, now)));
  // Şu an süren dönem en üstte
  return { items: items.sort((a, b) => Number(b.running) - Number(a.running)) };
}

export async function subscriptionStatusJson(studentId: string, id: string, now = new Date()) {
  const s = await db.questionSubscription.findUnique({ where: { id }, include: { teacher: TEACHER_SELECT, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!s || s.studentId !== studentId) throw notFound("Abonelik bulunamadı.");
  const last = s.payments[0];
  return { ...(await subscriptionJson(s, now)), payment: last ? { status: last.status, failureReason: last.failureReason } : null };
}

// ---------------------------------------------------------------------------
// Grup dersi
// ---------------------------------------------------------------------------

type CourseWithSessions = GroupCourse & { sessions: Pick<GroupSession, "startAt" | "endAt">[] };

async function groupCourseSummary(c: CourseWithSessions, now: Date) {
  const first = c.sessions[0];
  const last = c.sessions.at(-1);
  return {
    id: c.id,
    code: c.code,
    title: c.title,
    levelName: c.levelName,
    subjectName: c.subjectName,
    price: c.price,
    capacity: c.capacity,
    minParticipants: c.minParticipants,
    seatsTaken: await seatsTaken(c.id, now),
    enrollDeadline: c.enrollDeadline,
    sessionCount: c.sessions.length,
    firstStartAt: first?.startAt ?? null,
    lastEndAt: last?.endAt ?? null,
    durationMinutes: first ? Math.round((first.endAt.getTime() - first.startAt.getTime()) / 60_000) : 0,
    status: c.status,
    statusLabel: GROUP_COURSE_STATUS[c.status]?.label ?? c.status,
  };
}

/** Herkese açık, kayıtları süren grup dersleri. */
export async function groupCoursesJson(now = new Date()) {
  const settings = await loadSettings();
  if (!settings.groupsEnabled) return { enabled: false, items: [] };
  const rows = await db.groupCourse.findMany({
    where: { status: "OPEN", isPublic: true, enrollDeadline: { gt: now }, teacher: { status: "PUBLISHED", user: { status: "ACTIVE" } } },
    orderBy: { enrollDeadline: "asc" },
    take: 100,
    include: { sessions: { orderBy: { index: "asc" }, select: { startAt: true, endAt: true } }, teacher: TEACHER_SELECT },
  });
  return { enabled: true, items: await Promise.all(rows.map(async (c) => ({ ...(await groupCourseSummary(c, now)), teacher: teacherJson(c.teacher) }))) };
}

function enrollmentJson(e: GroupEnrollment) {
  return {
    id: e.id,
    code: e.code,
    status: e.status,
    statusLabel: GROUP_ENROLLMENT_STATUS[e.status]?.label ?? e.status,
    price: e.price,
    discountAmount: e.discountAmount,
    refundedAmount: e.refundedAmount,
    learnerName: e.learnerName,
    holdExpiresAt: e.holdExpiresAt,
    paidAt: e.paidAt,
  };
}

/** Grup dersi ayrıntısı (koddan): program, kontenjan; izleyici öğrenciyse kendi kaydı ve yapabilecekleri. */
export async function groupCourseJson(code: string, viewer: { id: string; role: string } | null, now = new Date()) {
  const course = await db.groupCourse.findUnique({
    where: { code },
    include: { sessions: { orderBy: { index: "asc" } }, teacher: { select: { ...TEACHER_SELECT.select, headline: true, status: true } } },
  });
  if (!course || course.teacher.status !== "PUBLISHED") throw notFound("Grup dersi bulunamadı.");
  const mine = viewer?.role === "STUDENT" ? await db.groupEnrollment.findUnique({ where: { courseId_studentId: { courseId: course.id, studentId: viewer.id } } }) : null;
  const isTeacher = viewer?.id === course.teacherId;
  if (!course.isPublic && !mine && !isTeacher) throw notFound("Grup dersi bulunamadı.");
  const summary = await groupCourseSummary(course, now);
  const open = course.status === "OPEN" && course.enrollDeadline > now;
  const paid = mine?.status === "PAID";
  const settings = await loadSettings();
  return {
    ...summary,
    description: course.description,
    isPublic: course.isPublic,
    teacher: { ...teacherJson(course.teacher), headline: course.teacher.headline },
    sessions: course.sessions.map((s) => {
      const opensAt = new Date(s.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
      return {
        id: s.id,
        index: s.index,
        startAt: s.startAt,
        endAt: s.endAt,
        status: s.status,
        statusLabel: GROUP_SESSION_STATUS[s.status]?.label ?? s.status,
        // Sanal sınıf: kesinleşmiş derste, oturum saatinde açılır (giriş adresi /grup-dersleri/oturum/{id}/sinif)
        canJoin: (paid || isTeacher) && course.status === "CONFIRMED" && s.status === "SCHEDULED" && now >= opensAt && now <= new Date(s.endAt.getTime() + 15 * 60_000),
        opensAt,
      };
    }),
    enrollment: mine ? enrollmentJson(mine) : null,
    actions: {
      canEnroll: viewer?.role === "STUDENT" && open && !paid && summary.seatsTaken < course.capacity,
      canCancel: Boolean(mine && (["INVITED", "PENDING_PAYMENT"].includes(mine.status) || (paid && course.sessions[0] && course.sessions[0].startAt > now))),
    },
  };
}

/** Öğrencinin grup dersleri (kayıtları). */
export async function myGroupsJson(studentId: string, now = new Date()) {
  const rows = await db.groupEnrollment.findMany({
    where: { studentId, status: { in: ["INVITED", "PENDING_PAYMENT", "PAID", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { course: { include: { sessions: { orderBy: { index: "asc" }, select: { startAt: true, endAt: true } }, teacher: TEACHER_SELECT } } },
  });
  return {
    items: await Promise.all(rows.map(async (e) => ({ ...enrollmentJson(e), course: { ...(await groupCourseSummary(e.course, now)), teacher: teacherJson(e.course.teacher) } }))),
  };
}

/** Öğretmenin grup dersleri (oturumlar ve kayıt sayısı; ders açma web panelinde). */
export async function teacherGroupsJson(teacherId: string, now = new Date()) {
  const rows = await db.groupCourse.findMany({
    where: { teacherId, status: { in: ["OPEN", "CONFIRMED", "COMPLETED"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { sessions: { orderBy: { index: "asc" }, select: { startAt: true, endAt: true } } },
  });
  return { items: await Promise.all(rows.map((c) => groupCourseSummary(c, now))) };
}

/** Ödeme sonrası sorgulanan kayıt durumu. */
export async function enrollmentStatusJson(studentId: string, id: string) {
  const e = await db.groupEnrollment.findUnique({ where: { id }, include: { course: { select: { code: true, title: true } }, payments: { orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!e || e.studentId !== studentId) throw notFound("Kayıt bulunamadı.");
  const last = e.payments[0];
  return { ...enrollmentJson(e), course: { code: e.course.code, title: e.course.title }, payment: last ? { status: last.status, failureReason: last.failureReason } : null };
}

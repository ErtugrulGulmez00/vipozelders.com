import { db } from "../db";
import type { MobileUser } from "./auth";
import { absoluteUpload } from "./serialize";

/** Giriş yapan kullanıcının uygulamadaki özeti (GET /ben ve giriş yanıtı). */
export async function meJson(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      studentProfile: { include: { city: true } },
      teacherProfile: { select: { slug: true, status: true, photoKey: true, verificationStatus: true } },
      _count: { select: { notifications: { where: { readAt: null } } } },
    },
  });
  return {
    id: user.id,
    role: user.role as MobileUser["role"],
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerifiedAt),
    mustChangePassword: user.mustChangePassword,
    unreadNotifications: user._count.notifications,
    student: user.studentProfile
      ? {
          accountType: user.studentProfile.accountType,
          city: user.studentProfile.city ? { id: user.studentProfile.city.id, name: user.studentProfile.city.name } : null,
          marketingConsent: user.studentProfile.marketingConsent,
        }
      : null,
    teacher: user.teacherProfile
      ? {
          slug: user.teacherProfile.slug,
          status: user.teacherProfile.status,
          verified: user.teacherProfile.verificationStatus === "VERIFIED",
          photoUrl: absoluteUpload(user.teacherProfile.photoKey),
        }
      : null,
  };
}

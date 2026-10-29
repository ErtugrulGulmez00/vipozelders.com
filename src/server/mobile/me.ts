import { CENTER_NOTIFICATION_PREFIX, kurumHome, notificationScope } from "@/lib/sides";
import { creditBalance } from "../credits";
import { db } from "../db";
import { unreadThreadCount } from "../messages";
import { sideFacts } from "../sides";
import type { MobileAccount } from "./auth";
import { absoluteUpload } from "./serialize";

/** Giriş yapan kullanıcının uygulamadaki özeti (GET /ben ve giriş yanıtı). */
export async function meJson(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      studentProfile: { include: { city: true } },
      teacherProfile: { select: { slug: true, status: true, photoKey: true, verificationStatus: true } },
    },
  });
  const role = user.role as MobileAccount["role"];
  const asTeacher = role === "TEACHER";
  const unreadWhere = { userId: user.id, readAt: null };
  const [facts, unreadMessages, credits, unreadAll, unreadCenter] = await Promise.all([
    sideFacts(user.id, role),
    role === "STUDENT" || asTeacher ? unreadThreadCount(user.id, asTeacher ? "teacher" : "student") : Promise.resolve(0),
    role === "STUDENT" ? creditBalance(user.id) : Promise.resolve(null),
    db.notification.count({ where: unreadWhere }),
    db.notification.count({ where: { ...unreadWhere, type: { startsWith: CENTER_NOTIFICATION_PREFIX } } }),
  ]);
  // İki tarafı olan hesapta bildirimler taraflara ayrılır (kurum: center.*, özel ders: diğerleri)
  const split = notificationScope(facts, "kurum") === "center";
  return {
    id: user.id,
    role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    emailVerified: Boolean(user.emailVerifiedAt),
    mustChangePassword: user.mustChangePassword,
    unreadNotifications: unreadAll,
    // Taraf başına okunmamış bildirim (yalnızca iki taraflı hesapta; değilse null ve unreadNotifications geçerli)
    unreadBySide: split ? { kurum: unreadCenter, ozel: unreadAll - unreadCenter } : null,
    unreadMessages,
    // Soru kredisi bakiyesi (yalnızca veli/öğrenci)
    questionCredits: credits,
    // Önemli bildirimleri WhatsApp ile de almak istiyor (PATCH /ben whatsappNotifications)
    whatsappNotifications: !user.whatsappOptOut,
    // Tek hesap, iki taraf (src/lib/sides.ts): kurum (personel paneli ya da veli/öğrenci portalı) ve özel ders.
    // Uygulama giriş kapısına göre tarafı seçer; o tarafı olmayan kendi tarafına geçer.
    sides: {
      kurum: Boolean(kurumHome(facts)),
      ozel: role !== "CENTER" && facts.privateSide,
      staff: facts.staff,
      portal: facts.portal,
      privateActivity: facts.privateActivity,
    },
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

import { Bell, CalendarDays, CreditCard, GraduationCap, Heart, Inbox, LayoutDashboard, MessageCircle, UserRound, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/panel-shell";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { unreadThreadCount } from "@/server/messages";
import { loadSettings } from "@/server/settings";
import { sideFacts } from "@/server/sides";

export const instant = false;

/** Özel ders tarafı (veli / öğrenci). Kurum portalı ayrı düzende: /hesabim/kurum. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  const facts = await sideFacts(user.id, user.role);
  // Kurumun açtığı öğrenci hesabında özel ders tarafı yok: kurum tarafına gider
  if (!facts.privateSide) redirect("/hesabim/kurum");
  const [unread, unreadMessages, settings, legacy] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "ozel")) } }),
    unreadThreadCount(user.id, "student"),
    loadSettings(),
    studentLegacyUsage(user.id),
  ]);
  // Randevu ve ödeme kapalıyken eski modelin bölümleri gösterilmez (eski kaydı olan hesapta da)
  const show = (_used: boolean) => settings.lessonBookingEnabled;
  return (
    <PanelShell
      user={user}
      title="Öğrenci / Veli"
      switchLinks={sideSwitches(facts, "student")}
      nav={[
        { href: "/hesabim", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/hesabim/ders-talepleri", label: "Ders taleplerim", icon: <Inbox /> },
        ...(facts.kocStudent ? [{ href: "/kocum", label: "Koçum", icon: <GraduationCap /> }] : []),
        ...(show(legacy.bookings > 0 || legacy.packages > 0) ? [{ href: "/hesabim/derslerim", label: "Derslerim", icon: <CalendarDays />, also: ["/hesabim/paketlerim"] }] : []),
        { href: "/hesabim/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        ...(show(legacy.groups > 0) && settings.groupsEnabled ? [{ href: "/hesabim/grup-derslerim", label: "Grup derslerim", icon: <Users /> }] : []),
        { href: "/hesabim/favoriler", label: "Favori öğretmenler", icon: <Heart /> },
        ...(show(legacy.payments > 0) ? [{ href: "/hesabim/odemeler", label: "Ödemelerim", icon: <CreditCard /> }] : []),
        { href: "/hesabim/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/hesabim/profil", label: "Hesap ayarları", icon: <UserRound /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}

/** Eski (randevu/ödeme) modelinde kaydı olan velinin menüsü geçmişini gösterebilsin. */
async function studentLegacyUsage(studentId: string) {
  const [bookings, packages, groups, payments] = await Promise.all([
    db.booking.count({ where: { studentId } }),
    db.lessonPackage.count({ where: { studentId, status: { in: ["PAID", "CLOSED"] } } }),
    db.groupEnrollment.count({ where: { studentId, status: { in: ["PAID", "CANCELLED"] } } }),
    db.payment.count({ where: { status: { not: "INITIATED" }, OR: [{ booking: { studentId } }, { groupEnrollment: { studentId } }, { package: { studentId } }] } }),
  ]);
  return { bookings, packages, groups, payments };
}

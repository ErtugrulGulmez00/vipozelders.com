import { Bell, Gift, Building2, CalendarDays, CreditCard, Heart, LayoutDashboard, MessageCircle, MessageCircleQuestion, UserRound, Users } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { unreadThreadCount } from "@/server/messages";

export const instant = false;

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  const [unread, centerLinks, unreadMessages] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.centerGuardian.count({ where: { userId: user.id } }),
    unreadThreadCount(user.id, "student"),
  ]);
  return (
    <PanelShell
      user={user}
      title="Öğrenci / Veli"
      nav={[
        { href: "/hesabim", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/hesabim/derslerim", label: "Derslerim", icon: <CalendarDays />, also: ["/hesabim/paketlerim"] },
        { href: "/hesabim/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        { href: "/hesabim/sorularim", label: "Soru çözüm", icon: <MessageCircleQuestion />, also: ["/hesabim/krediler", "/hesabim/abonelikler"] },
        { href: "/hesabim/grup-derslerim", label: "Grup derslerim", icon: <Users /> },
        ...(centerLinks ? [{ href: "/hesabim/kurum", label: "Kurumum (etüt / dershane)", icon: <Building2 /> }] : []),
        { href: "/hesabim/favoriler", label: "Favori öğretmenler", icon: <Heart /> },
        { href: "/hesabim/odemeler", label: "Ödemelerim", icon: <CreditCard /> },
        { href: "/hesabim/davet", label: "Arkadaşını davet et", icon: <Gift /> },
        { href: "/hesabim/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/hesabim/profil", label: "Hesap ayarları", icon: <UserRound /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}

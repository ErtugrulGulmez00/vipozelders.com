import { Bell, Gift, CalendarDays, CreditCard, Heart, LayoutDashboard, MessageCircle, MessageCircleQuestion, UserRound, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { PanelShell } from "@/components/panel/panel-shell";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { unreadThreadCount } from "@/server/messages";
import { sideFacts } from "@/server/sides";

export const instant = false;

/** Özel ders tarafı (veli / öğrenci). Kurum portalı ayrı düzende: /hesabim/kurum. */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  const facts = await sideFacts(user.id, user.role);
  // Kurumun açtığı öğrenci hesabında özel ders tarafı yok: kurum tarafına gider
  if (!facts.privateSide) redirect("/hesabim/kurum");
  const [unread, unreadMessages] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "ozel")) } }),
    unreadThreadCount(user.id, "student"),
  ]);
  return (
    <PanelShell
      user={user}
      title="Öğrenci / Veli"
      switchLinks={sideSwitches(facts, "student")}
      nav={[
        { href: "/hesabim", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/hesabim/derslerim", label: "Derslerim", icon: <CalendarDays />, also: ["/hesabim/paketlerim"] },
        { href: "/hesabim/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        { href: "/hesabim/sorularim", label: "Soru çözüm", icon: <MessageCircleQuestion />, also: ["/hesabim/krediler", "/hesabim/abonelikler"] },
        { href: "/hesabim/grup-derslerim", label: "Grup derslerim", icon: <Users /> },
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

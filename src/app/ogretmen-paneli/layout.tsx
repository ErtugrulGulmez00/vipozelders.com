import { Bell, CalendarClock, CalendarDays, LayoutDashboard, MessageCircle, MessageCircleQuestion, MessageSquareQuote, Repeat, Settings, Users, UserRound, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { unreadThreadCount } from "@/server/messages";
import { sideFacts } from "@/server/sides";

export const instant = false;

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER");
  const facts = await sideFacts(user.id, user.role);
  const [pending, unread, poolActive, unreadMessages] = await Promise.all([
    db.booking.count({ where: { teacherId: user.id, status: "PENDING_APPROVAL" } }),
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "ozel")) } }),
    db.poolQuestion.count({ where: { claimedById: user.id, OR: [{ status: "CLAIMED" }, { followUpText: { not: null }, followUpAnswer: null, status: { in: ["ANSWERED", "CLOSED", "DISPUTED"] } }] } }),
    unreadThreadCount(user.id, "teacher"),
  ]);
  return (
    <PanelShell
      user={user}
      title="Öğretmen paneli"
      switchLinks={sideSwitches(facts, "teacher")}
      nav={[
        { href: "/ogretmen-paneli", label: "Özet", icon: <LayoutDashboard />, exact: true },
        // Bekleyen talep varsa başlık doğrudan taleplere götürür
        { href: pending ? "/ogretmen-paneli/talepler" : "/ogretmen-paneli/dersler", label: "Derslerim", icon: <CalendarDays />, badge: pending || undefined, also: ["/ogretmen-paneli/talepler", "/ogretmen-paneli/dersler"] },
        { href: "/ogretmen-paneli/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        { href: "/ogretmen-paneli/soru-havuzu", label: "Soru havuzu", icon: <MessageCircleQuestion />, badge: poolActive || undefined },
        { href: "/ogretmen-paneli/soru-aboneligi", label: "Soru aboneliği", icon: <Repeat /> },
        { href: "/ogretmen-paneli/grup-dersleri", label: "Grup dersleri", icon: <Users /> },
        { href: "/ogretmen-paneli/profil", label: "Profilim", icon: <UserRound />, also: ["/ogretmen-paneli/dersler-ve-fiyatlar", "/ogretmen-paneli/belgeler"] },
        { href: "/ogretmen-paneli/takvim", label: "Müsaitlik takvimi", icon: <CalendarClock /> },
        { href: "/ogretmen-paneli/kazanclar", label: "Kazançlarım", icon: <Wallet /> },
        { href: "/ogretmen-paneli/yorumlar", label: "Yorumlar", icon: <MessageSquareQuote /> },
        { href: "/ogretmen-paneli/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/ogretmen-paneli/ayarlar", label: "Hesap ayarları", icon: <Settings /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}

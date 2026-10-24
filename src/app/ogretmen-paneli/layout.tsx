import { Bell, Building2, CalendarClock, CalendarDays, FileCheck2, Inbox, LayoutDashboard, ListChecks, MessageCircle, MessageCircleQuestion, MessageSquareQuote, Repeat, Settings, Users, UserRound, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { unreadThreadCount } from "@/server/messages";

export const instant = false;

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER");
  const [pending, unread, centerMemberships, poolActive, unreadMessages] = await Promise.all([
    db.booking.count({ where: { teacherId: user.id, status: "PENDING_APPROVAL" } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.centerMember.count({ where: { userId: user.id, isActive: true } }),
    db.poolQuestion.count({ where: { claimedById: user.id, OR: [{ status: "CLAIMED" }, { followUpText: { not: null }, followUpAnswer: null, status: { in: ["ANSWERED", "CLOSED", "DISPUTED"] } }] } }),
    unreadThreadCount(user.id, "teacher"),
  ]);
  return (
    <PanelShell
      user={user}
      title="Öğretmen paneli"
      nav={[
        { href: "/ogretmen-paneli", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/ogretmen-paneli/talepler", label: "Ders talepleri", icon: <Inbox />, badge: pending || undefined },
        { href: "/ogretmen-paneli/dersler", label: "Derslerim", icon: <CalendarDays /> },
        { href: "/ogretmen-paneli/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        { href: "/ogretmen-paneli/soru-havuzu", label: "Soru havuzu", icon: <MessageCircleQuestion />, badge: poolActive || undefined },
        { href: "/ogretmen-paneli/soru-aboneligi", label: "Soru aboneliği", icon: <Repeat /> },
        { href: "/ogretmen-paneli/grup-dersleri", label: "Grup dersleri", icon: <Users /> },
        { href: "/ogretmen-paneli/profil", label: "Profilim", icon: <UserRound /> },
        { href: "/ogretmen-paneli/dersler-ve-fiyatlar", label: "Dersler ve fiyatlar", icon: <ListChecks /> },
        { href: "/ogretmen-paneli/takvim", label: "Müsaitlik takvimi", icon: <CalendarClock /> },
        { href: "/ogretmen-paneli/belgeler", label: "Belgelerim", icon: <FileCheck2 /> },
        { href: "/ogretmen-paneli/kazanclar", label: "Kazançlarım", icon: <Wallet /> },
        { href: "/ogretmen-paneli/yorumlar", label: "Yorumlar", icon: <MessageSquareQuote /> },
        { href: "/ogretmen-paneli/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/ogretmen-paneli/ayarlar", label: "Hesap ayarları", icon: <Settings /> },
        // Bir etüt merkezinde/dershanede de görevli öğretmenler için
        ...(centerMemberships ? [{ href: "/kurum", label: "Kurum paneli", icon: <Building2 /> }] : []),
      ]}
    >
      {children}
    </PanelShell>
  );
}

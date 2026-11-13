import { Bell, CalendarClock, CalendarDays, Inbox, LayoutDashboard, Link2, MessageCircle, MessageCircleQuestion, MessageSquareQuote, Settings, Users, UserRound, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { questionSessionRightCount } from "@/server/lesson-links";
import { unreadThreadCount } from "@/server/messages";
import { sideFacts } from "@/server/sides";
import { pendingInquiryCount } from "@/server/teacher-inquiries";

export const instant = false;

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER");
  const facts = await sideFacts(user.id, user.role);
  const [pending, unread, questionRights, unreadMessages, inquiries] = await Promise.all([
    db.booking.count({ where: { teacherId: user.id, status: "PENDING_APPROVAL" } }),
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "ozel")) } }),
    questionSessionRightCount(user.id),
    unreadThreadCount(user.id, "teacher"),
    pendingInquiryCount(user.id),
  ]);
  return (
    <PanelShell
      user={user}
      title="Öğretmen paneli"
      switchLinks={sideSwitches(facts, "teacher")}
      nav={[
        { href: "/ogretmen-paneli", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/ogretmen-paneli/ders-talepleri", label: "Ders talepleri", icon: <Inbox />, badge: inquiries || undefined },
        // Bekleyen talep varsa başlık doğrudan taleplere götürür
        { href: pending ? "/ogretmen-paneli/talepler" : "/ogretmen-paneli/dersler", label: "Derslerim", icon: <CalendarDays />, badge: pending || undefined, also: ["/ogretmen-paneli/talepler", "/ogretmen-paneli/dersler"] },
        { href: "/ogretmen-paneli/ders-baglantilari", label: "Ders bağlantıları", icon: <Link2 /> },
        { href: "/ogretmen-paneli/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        { href: "/ogretmen-paneli/soru-cozum", label: "Soru çözüm dersleri", icon: <MessageCircleQuestion />, badge: questionRights || undefined },
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

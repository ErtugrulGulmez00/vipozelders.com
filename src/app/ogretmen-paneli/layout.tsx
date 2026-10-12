import { Bell, CalendarClock, CalendarDays, FileCheck2, Inbox, LayoutDashboard, ListChecks, MessageSquareQuote, Settings, UserRound, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const instant = false;

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER");
  const [pending, unread] = await Promise.all([
    db.booking.count({ where: { teacherId: user.id, status: "PENDING_APPROVAL" } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return (
    <PanelShell
      user={user}
      title="Öğretmen paneli"
      nav={[
        { href: "/ogretmen-paneli", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/ogretmen-paneli/talepler", label: "Ders talepleri", icon: <Inbox />, badge: pending || undefined },
        { href: "/ogretmen-paneli/dersler", label: "Derslerim", icon: <CalendarDays /> },
        { href: "/ogretmen-paneli/profil", label: "Profilim", icon: <UserRound /> },
        { href: "/ogretmen-paneli/dersler-ve-fiyatlar", label: "Dersler ve fiyatlar", icon: <ListChecks /> },
        { href: "/ogretmen-paneli/takvim", label: "Müsaitlik takvimi", icon: <CalendarClock /> },
        { href: "/ogretmen-paneli/belgeler", label: "Belgelerim", icon: <FileCheck2 /> },
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

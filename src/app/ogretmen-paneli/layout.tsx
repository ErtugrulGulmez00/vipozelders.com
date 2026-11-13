import { Bell, CalendarClock, CalendarDays, GraduationCap, Inbox, LayoutDashboard, Link2, MessageCircle, MessageCircleQuestion, MessageSquareQuote, Settings, Users, UserRound, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { questionSessionRightCount } from "@/server/lesson-links";
import { unreadThreadCount } from "@/server/messages";
import { loadSettings } from "@/server/settings";
import { sideFacts } from "@/server/sides";
import { ensureTeacherCoach } from "@/server/koc-signup";
import { pendingInquiryCount } from "@/server/teacher-inquiries";

export const instant = false;

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("TEACHER");
  let facts = await sideFacts(user.id, user.role);
  // Her öğretmende Pi Koç ücretsiz paketi hazır olur (hesap açılırken açılamadıysa burada)
  if (!facts.kocStaff && (await ensureTeacherCoach(user.id).catch(() => null))) facts = await sideFacts(user.id, user.role);
  const [pending, unread, questionRights, unreadMessages, inquiries, settings, legacy] = await Promise.all([
    db.booking.count({ where: { teacherId: user.id, status: "PENDING_APPROVAL" } }),
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "ozel")) } }),
    questionSessionRightCount(user.id),
    unreadThreadCount(user.id, "teacher"),
    pendingInquiryCount(user.id),
    loadSettings(),
    legacyUsage(user.id),
  ]);
  // Randevu ve ödeme kapalıyken eski modelin menüleri yalnızca içinde kaydı olan öğretmene görünür
  const open = settings.lessonBookingEnabled;
  const show = (used: boolean) => open || used;
  return (
    <PanelShell
      user={user}
      title="Öğretmen paneli"
      switchLinks={sideSwitches(facts, "teacher")}
      nav={[
        { href: "/ogretmen-paneli", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/ogretmen-paneli/ders-talepleri", label: "Ders talepleri", icon: <Inbox />, badge: inquiries || undefined },
        // Bekleyen talep varsa başlık doğrudan taleplere götürür
        { href: facts.kocStaff ? "/koc" : "/pi-koc", label: "Pi Koç öğrencilerim", icon: <GraduationCap /> },
        { href: "/ogretmen-paneli/mesajlar", label: "Mesajlar", icon: <MessageCircle />, badge: unreadMessages || undefined },
        ...(show(legacy.bookings > 0 || pending > 0) ? [{ href: pending ? "/ogretmen-paneli/talepler" : "/ogretmen-paneli/dersler", label: "Derslerim", icon: <CalendarDays />, badge: pending || undefined, also: ["/ogretmen-paneli/talepler", "/ogretmen-paneli/dersler"] }] : []),
        ...(show(legacy.links > 0) ? [{ href: "/ogretmen-paneli/ders-baglantilari", label: "Ders bağlantıları", icon: <Link2 /> }] : []),
        ...(show(questionRights > 0) ? [{ href: "/ogretmen-paneli/soru-cozum", label: "Soru çözüm dersleri", icon: <MessageCircleQuestion />, badge: questionRights || undefined }] : []),
        ...((open && settings.groupsEnabled) || legacy.groups > 0 ? [{ href: "/ogretmen-paneli/grup-dersleri", label: "Grup dersleri", icon: <Users /> }] : []),
        { href: "/ogretmen-paneli/profil", label: "Profilim", icon: <UserRound />, also: ["/ogretmen-paneli/dersler-ve-fiyatlar", "/ogretmen-paneli/belgeler"] },
        // Takvim aramadaki saat süzgecini ve profildeki uygun saatleri besler; her modelde kalır
        { href: "/ogretmen-paneli/takvim", label: "Müsaitlik takvimi", icon: <CalendarClock /> },
        ...(show(legacy.ledger > 0) ? [{ href: "/ogretmen-paneli/kazanclar", label: "Kazançlarım", icon: <Wallet /> }] : []),
        { href: "/ogretmen-paneli/yorumlar", label: "Yorumlar", icon: <MessageSquareQuote /> },
        { href: "/ogretmen-paneli/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/ogretmen-paneli/ayarlar", label: "Hesap ayarları", icon: <Settings /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}

/** Eski (randevu/ödeme) modelinde kaydı olan öğretmenin menüsü geçmişini gösterebilsin. */
async function legacyUsage(teacherId: string) {
  const [bookings, links, groups, ledger] = await Promise.all([
    db.booking.count({ where: { teacherId } }),
    db.lessonLink.count({ where: { teacherId } }),
    // Kaydı (ödeme yapan öğrencisi) olan grup dersleri; boş ya da iptal edilmiş taslaklar sayılmaz
    db.groupCourse.count({ where: { teacherId, enrollments: { some: { status: { in: ["PAID", "CANCELLED"] } } } } }),
    db.ledgerEntry.count({ where: { teacherId } }),
  ]);
  return { bookings, links, groups, ledger };
}

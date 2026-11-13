import { BarChart3, Eye, HeartHandshake, MessageCircle, Inbox, PhoneCall, Newspaper, Bell, Bug, Building2, CreditCard, CalendarDays, FileText, FolderTree, GraduationCap, History, LayoutDashboard, Mail, MessageCircleWarning, MessageSquareQuote, Settings, ShieldAlert, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { threadsToReviewCount } from "@/server/messages";
import { loadSettings } from "@/server/settings";

export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  const [disputes, drafts, unread, applications, documents, centerApplications, openErrors, openReports, messagesToReview, lessonRequests, pendingInquiries, settings, liveMeetings, legacy] = await Promise.all([
    db.booking.count({ where: { status: "DISPUTED" } }),
    db.teacherProfile.count({ where: { status: "DRAFT" } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.teacherApplication.count({ where: { status: "NEW" } }),
    db.teacherDocument.count({ where: { status: "PENDING" } }),
    db.centerApplication.count({ where: { status: "NEW" } }),
    db.errorEvent.count({ where: { resolvedAt: null } }),
    db.classroomReport.count({ where: { resolvedAt: null } }),
    threadsToReviewCount(),
    db.lessonRequest.count({ where: { status: "NEW" } }),
    db.teacherInquiry.count({ where: { status: "PENDING" } }),
    loadSettings(),
    db.coachMeeting.count({ where: { endedAt: null } }),
    adminLegacyUsage(),
  ]);
  // Randevu ve ödeme kapalıyken eski modelin bölümleri yalnızca içinde kayıt varsa görünür
  const open = settings.lessonBookingEnabled;
  const show = (used: boolean) => open || used;
  return (
    <PanelShell
      user={user}
      title="Yönetim paneli"
      nav={[
        { href: "/yonetim", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/yonetim/istatistik", label: "İstatistik", icon: <BarChart3 /> },
        { href: "/yonetim/ogretmenler", label: "Öğretmenler", icon: <GraduationCap />, badge: drafts + documents || undefined },
        { href: "/yonetim/basvurular", label: "Başvurular", icon: <UserPlus />, badge: applications || undefined },
        { href: "/yonetim/ders-talepleri", label: "Ders talepleri", icon: <PhoneCall />, badge: pendingInquiries || undefined },
        { href: "/yonetim/talepler", label: "Öğretmen bulma istekleri", icon: <Inbox />, badge: lessonRequests || undefined },
        { href: "/yonetim/ogrenciler", label: "Öğrenciler / Veliler", icon: <Users /> },
        { href: "/yonetim/kurumlar", label: "Kurumlar", icon: <Building2 />, badge: centerApplications || undefined },
        { href: "/yonetim/pi-koc", label: "Pi Koç hesapları", icon: <HeartHandshake />, also: ["/yonetim/pi-koc/kodlar"] },
        { href: "/yonetim/canli-gorusmeler", label: "Canlı görüşmeler", icon: <Eye />, badge: liveMeetings || undefined },
        ...(show(legacy.bookings > 0) ? [{ href: "/yonetim/randevular", label: "Randevular", icon: <CalendarDays />, badge: disputes || undefined }] : []),
        { href: "/yonetim/mesajlar", label: "Mesaj denetimi", icon: <MessageCircleWarning />, badge: messagesToReview || undefined },
        ...(show(legacy.reports > 0) ? [{ href: "/yonetim/ders-bildirimleri", label: "Ders bildirimleri", icon: <ShieldAlert />, badge: openReports || undefined }] : []),
        ...((open && settings.groupsEnabled) || legacy.groups > 0 ? [{ href: "/yonetim/grup-dersleri", label: "Grup dersleri", icon: <Users /> }] : []),
        ...(show(legacy.ledger > 0) ? [{ href: "/yonetim/finans", label: "Finans", icon: <Wallet /> }] : []),
        ...(open ? [{ href: "/yonetim/odeme-testi", label: "Ödeme testi", icon: <CreditCard /> }] : []),
        { href: "/yonetim/yorumlar", label: "Yorumlar", icon: <MessageSquareQuote /> },
        { href: "/yonetim/kategoriler", label: "Kategoriler", icon: <FolderTree /> },
        { href: "/yonetim/sayfalar", label: "Sayfalar", icon: <FileText /> },
        { href: "/yonetim/rehber", label: "Rehber yazıları", icon: <Newspaper /> },
        { href: "/yonetim/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/yonetim/e-postalar", label: "E-posta kutusu", icon: <Mail /> },
        { href: "/yonetim/whatsapp", label: "WhatsApp", icon: <MessageCircle /> },
        { href: "/yonetim/hatalar", label: "Hatalar", icon: <Bug />, badge: openErrors || undefined },
        { href: "/yonetim/islem-kayitlari", label: "İşlem kayıtları", icon: <History /> },
        { href: "/yonetim/ayarlar", label: "Site ayarları", icon: <Settings /> },
        { href: "/yonetim/guvenlik", label: "Güvenlik", icon: <ShieldCheck /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}

/** Eski (randevu/ödeme) modelinde kayıt varsa yönetimde geçmişe ait bölümler görünür. */
async function adminLegacyUsage() {
  const [bookings, reports, groups, ledger] = await Promise.all([
    db.booking.count(),
    db.classroomReport.count(),
    db.groupCourse.count({ where: { OR: [{ status: "OPEN" }, { enrollments: { some: { status: { in: ["PAID", "CANCELLED"] } } } }] } }),
    db.ledgerEntry.count(),
  ]);
  return { bookings, reports, groups, ledger };
}

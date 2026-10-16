import { Bell, Building2, CalendarDays, FileText, FolderTree, GraduationCap, History, LayoutDashboard, Mail, MessageCircleQuestion, MessageSquareQuote, Settings, ShieldCheck, UserPlus, Users, Wallet } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  const [disputes, drafts, unread, applications, documents, centerApplications, poolDisputes] = await Promise.all([
    db.booking.count({ where: { status: "DISPUTED" } }),
    db.teacherProfile.count({ where: { status: "DRAFT" } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.teacherApplication.count({ where: { status: "NEW" } }),
    db.teacherDocument.count({ where: { status: "PENDING" } }),
    db.centerApplication.count({ where: { status: "NEW" } }),
    db.poolQuestion.count({ where: { status: "DISPUTED" } }),
  ]);
  return (
    <PanelShell
      user={user}
      title="Yönetim paneli"
      nav={[
        { href: "/yonetim", label: "Özet", icon: <LayoutDashboard />, exact: true },
        { href: "/yonetim/ogretmenler", label: "Öğretmenler", icon: <GraduationCap />, badge: drafts + documents || undefined },
        { href: "/yonetim/basvurular", label: "Başvurular", icon: <UserPlus />, badge: applications || undefined },
        { href: "/yonetim/ogrenciler", label: "Öğrenciler / Veliler", icon: <Users /> },
        { href: "/yonetim/kurumlar", label: "Kurumlar", icon: <Building2 />, badge: centerApplications || undefined },
        { href: "/yonetim/randevular", label: "Randevular", icon: <CalendarDays />, badge: disputes || undefined },
        { href: "/yonetim/soru-havuzu", label: "Soru havuzu", icon: <MessageCircleQuestion />, badge: poolDisputes || undefined },
        { href: "/yonetim/finans", label: "Finans", icon: <Wallet /> },
        { href: "/yonetim/yorumlar", label: "Yorumlar", icon: <MessageSquareQuote /> },
        { href: "/yonetim/kategoriler", label: "Kategoriler", icon: <FolderTree /> },
        { href: "/yonetim/sayfalar", label: "Sayfalar", icon: <FileText /> },
        { href: "/yonetim/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
        { href: "/yonetim/e-postalar", label: "E-posta kutusu", icon: <Mail /> },
        { href: "/yonetim/islem-kayitlari", label: "İşlem kayıtları", icon: <History /> },
        { href: "/yonetim/ayarlar", label: "Site ayarları", icon: <Settings /> },
        { href: "/yonetim/guvenlik", label: "Güvenlik", icon: <ShieldCheck /> },
      ]}
    >
      {children}
    </PanelShell>
  );
}

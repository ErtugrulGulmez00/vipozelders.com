import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Repeat,
  Settings,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { SubscriptionBanner } from "@/components/center/center-ui";
import { PanelShell } from "@/components/panel/panel-shell";
import type { PanelNavItem } from "@/components/panel/nav-links";
import { CENTER_ROLE_LABEL, type CenterPermission } from "@/lib/center/permissions";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const instant = false;

export default async function CenterLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCenter();
  const [unread, newLeads] = await Promise.all([
    db.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
    ctx.can("leads.manage") ? db.centerLead.count({ where: { centerId: ctx.center.id, status: "NEW" } }) : Promise.resolve(0),
  ]);
  const items: (PanelNavItem & { permission?: CenterPermission })[] = [
    { href: "/kurum", label: "Özet", icon: <LayoutDashboard />, exact: true },
    { href: "/kurum/ogrenciler", label: "Öğrenciler", icon: <Users />, permission: "students.view" },
    { href: "/kurum/siniflar", label: "Sınıflar", icon: <UsersRound />, permission: "students.view" },
    { href: "/kurum/program", label: "Ders programı", icon: <CalendarRange />, permission: "students.view" },
    { href: "/kurum/yoklama", label: "Yoklama", icon: <ClipboardCheck />, permission: "attendance.take" },
    { href: "/kurum/etutler", label: "Etütler", icon: <CalendarClock />, permission: "etud.manage" },
    { href: "/kurum/denemeler", label: "Denemeler", icon: <BookOpenCheck />, permission: "exams.manage" },
    { href: "/kurum/muhasebe", label: "Muhasebe", icon: <Wallet />, permission: "finance.view" },
    { href: "/kurum/duyurular", label: "Duyurular", icon: <Megaphone />, permission: "messages.send" },
    { href: "/kurum/mesajlar", label: "SMS / e-posta geçmişi", icon: <MessagesSquare />, permission: "messages.send" },
    { href: "/kurum/on-kayit", label: "Ön kayıtlar", icon: <UserPlus />, permission: "leads.manage", badge: newLeads || undefined },
    { href: "/kurum/personel", label: "Personel", icon: <UserRound />, permission: "staff.manage" },
    { href: "/kurum/ayarlar", label: "Kurum ayarları", icon: <Settings />, permission: "settings.manage" },
    { href: "/kurum/abonelik", label: "Abonelik", icon: <CreditCard />, permission: "subscription.view" },
    { href: "/kurum/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
    { href: "/kurum/hesap", label: "Hesabım", icon: <Building2 /> },
  ];
  if (ctx.memberships.length > 1) items.push({ href: "/kurum/kurum-sec", label: "Kurum değiştir", icon: <Repeat /> });
  const nav: PanelNavItem[] = items
    .filter((item) => !item.permission || ctx.can(item.permission))
    .map((item) => ({ href: item.href, label: item.label, icon: item.icon, badge: item.badge, exact: item.exact }));
  return (
    <PanelShell
      user={ctx.user}
      title={ctx.center.name}
      roleLabel={ctx.member.title || CENTER_ROLE_LABEL[ctx.member.role]}
      nav={nav}
      banner={<SubscriptionBanner access={ctx.access} canManage={ctx.can("subscription.view")} />}
    >
      {children}
    </PanelShell>
  );
}

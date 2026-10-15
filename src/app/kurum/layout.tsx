import {
  Bell,
  BookMarked,
  BookText,
  HeartHandshake,
  Library,
  BookOpenCheck,
  Building2,
  Camera,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  NotebookPen,
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
  const [unread, newLeads, openQuestions] = await Promise.all([
    db.notification.count({ where: { userId: ctx.user.id, readAt: null } }),
    ctx.can("leads.manage") ? db.centerLead.count({ where: { centerId: ctx.center.id, status: "NEW" } }) : Promise.resolve(0),
    ctx.can("questions.answer") ? db.centerQuestion.count({ where: { centerId: ctx.center.id, status: "OPEN" } }) : Promise.resolve(0),
  ]);
  const items: (PanelNavItem & { permission?: CenterPermission })[] = [
    { href: "/kurum", label: "Özet", icon: <LayoutDashboard />, exact: true },
    { href: "/kurum/ogrenciler", label: "Öğrenciler", icon: <Users />, permission: "students.view" },
    { href: "/kurum/siniflar", label: "Sınıflar", icon: <UsersRound />, permission: "students.view" },
    { href: "/kurum/program", label: "Ders programı", icon: <CalendarRange />, permission: "students.view" },
    { href: "/kurum/yoklama", label: "Yoklama", icon: <ClipboardCheck />, permission: "attendance.take" },
    { href: "/kurum/etutler", label: "Etütler", icon: <CalendarClock />, permission: "etud.manage" },
    { href: "/kurum/odevler", label: "Ödevler", icon: <NotebookPen />, permission: "homework.manage" },
    { href: "/kurum/kaynaklar", label: "Kaynaklar ve kitaplar", icon: <BookMarked />, permission: "resources.manage" },
    { href: "/kurum/kocluk", label: "Koçluk", icon: <HeartHandshake />, permission: "coaching.manage" },
    { href: "/kurum/calisma-salonu", label: "Çalışma salonu", icon: <Library />, permission: "attendance.take" },
    { href: "/kurum/sinif-defteri", label: "Sınıf defteri", icon: <BookText />, permission: "students.view" },
    { href: "/kurum/sorular", label: "Öğrenci soruları", icon: <Camera />, permission: "questions.answer", badge: openQuestions || undefined },
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
      headerSlot={
        ctx.can("students.view") ? (
          <form action="/kurum/ogrenciler" method="get" role="search" className="max-w-md">
            <input type="hidden" name="ara" value="1" />
            <input name="q" type="search" placeholder="Öğrenci ara: ad, numara, veli telefonu" aria-label="Öğrenci ara" className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm focus:border-brand-400 focus:bg-white focus:outline-none" />
          </form>
        ) : null
      }
    >
      {children}
    </PanelShell>
  );
}

import {
  Bell,
  BookMarked,
  BookText,
  HeartHandshake,
  Library,
  BookOpenCheck,
  Camera,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  ChartColumn,
  CreditCard,
  DoorOpen,
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
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubscriptionBanner } from "@/components/center/center-ui";
import { NotificationChannelProvider } from "@/components/notification-channel";
import { PanelShell } from "@/components/panel/panel-shell";
import type { PanelNavItem } from "@/components/panel/nav-links";
import { moduleForPath, sectionAllowed, type CenterModuleKey } from "@/lib/center/modules";
import { CENTER_ROLE_LABEL, type CenterPermission } from "@/lib/center/permissions";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { sideFacts } from "@/server/sides";

export const instant = false;

export default async function CenterLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCenter();
  // Pi Koç hesabı kendi panelini kullanır
  if (ctx.center.kind === "COACH") redirect("/koc");
  const facts = await sideFacts(ctx.user.id, ctx.user.role);
  const [unread, newLeads, openQuestions, settings] = await Promise.all([
    db.notification.count({ where: { userId: ctx.user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "kurum")) } }),
    ctx.can("leads.manage") ? db.centerLead.count({ where: { centerId: ctx.center.id, status: "NEW" } }) : Promise.resolve(0),
    ctx.can("questions.answer") ? db.centerQuestion.count({ where: { centerId: ctx.center.id, status: "OPEN" } }) : Promise.resolve(0),
    loadSettings(),
  ]);
  const on = (key: CenterModuleKey) => !ctx.center.disabledModules.includes(key);
  const coachingHref = ctx.can("coaching.manage") && on("kocluk") ? "/kurum/kocluk" : ctx.can("resources.manage") && on("kaynaklar") ? "/kurum/kaynaklar" : null;
  // Yakın bölümler tek maddede (sayfada sekme olarak) durur; başlıklar menüyü işe göre ayırır.
  const items: (PanelNavItem & { permission?: CenterPermission; visible?: boolean })[] = [
    { href: "/kurum", label: "Özet", icon: <LayoutDashboard />, exact: true },
    { group: "Öğrenci takibi", href: "/kurum/ogrenciler", label: "Öğrenciler", icon: <Users />, permission: "students.view", also: ["/kurum/siniflar"] },
    ...(coachingHref ? [{ group: "Öğrenci takibi", href: coachingHref, label: "Koçluk ve kaynaklar", icon: <HeartHandshake />, also: ["/kurum/kocluk", "/kurum/kaynaklar"] }] : []),
    { group: "Öğrenci takibi", href: "/kurum/denemeler", label: "Denemeler", icon: <BookOpenCheck />, permission: "exams.manage" },
    { group: "Öğrenci takibi", href: "/kurum/odevler", label: "Ödevler", icon: <NotebookPen />, permission: "homework.manage" },
    { group: "Öğrenci takibi", href: "/kurum/sorular", label: "Öğrenci soruları", icon: <Camera />, permission: "questions.answer", badge: openQuestions || undefined },
    { group: "Etüt ve salon", href: "/kurum/etutler", label: "Etüt planı", icon: <CalendarClock />, permission: "etud.manage" },
    { group: "Etüt ve salon", href: "/kurum/calisma-salonu", label: "Çalışma salonu", icon: <Library />, permission: "attendance.take" },
    // Dershane bölümleri: yalnızca türü Dershane olan kurumda
    { group: "Dershane", href: "/kurum/program", label: "Ders programı", icon: <CalendarRange />, permission: "students.view" },
    { group: "Dershane", href: "/kurum/yoklama", label: "Sınıf yoklaması", icon: <ClipboardCheck />, permission: "attendance.take" },
    { group: "Dershane", href: "/kurum/sinif-defteri", label: "Sınıf defteri", icon: <BookText />, permission: "students.view" },
    { group: "Dershane", href: "/kurum/derslikler", label: "Derslikler", icon: <DoorOpen />, permission: "students.view" },
    { group: "Dershane", href: "/kurum/raporlar", label: "Raporlar", icon: <ChartColumn />, permission: "reports.view" },
    { group: "Veli ve iletişim", href: "/kurum/duyurular", label: "Duyuru ve mesajlar", icon: <Megaphone />, permission: "messages.send", also: ["/kurum/mesajlar"] },
    { group: "Veli ve iletişim", href: "/kurum/on-kayit", label: "Ön kayıtlar", icon: <UserPlus />, permission: "leads.manage", badge: newLeads || undefined },
    { group: "Kurum", href: "/kurum/muhasebe", label: "Muhasebe", icon: <Wallet />, permission: "finance.view" },
    { group: "Kurum", href: "/kurum/personel", label: "Personel", icon: <UserRound />, permission: "staff.manage" },
    { group: "Kurum", href: "/kurum/ayarlar", label: "Kurum ayarları", icon: <Settings />, permission: "settings.manage" },
    { group: "Kurum", href: "/kurum/abonelik", label: "Abonelik", icon: <CreditCard />, permission: "subscription.view" },
  ];
  if (ctx.memberships.length > 1) items.push({ group: "Kurum", href: "/kurum/kurum-sec", label: "Kurum değiştir", icon: <Repeat /> });
  items.push({ group: "Kurum", href: "/kurum/hesap", label: "Hesabım", icon: <UserRound /> });
  const nav: PanelNavItem[] = items
    .filter((item) => !item.permission || ctx.can(item.permission))
    .filter((item) => {
      const key = moduleForPath(item.href);
      if (!sectionAllowed(ctx.center, item.href.split("/")[2] ?? "")) return false;
      return !key || on(key);
    })
    .map(({ permission: _permission, visible: _visible, ...item }) => item);
  return (
    <PanelShell
      user={ctx.user}
      title={ctx.center.name}
      roleLabel={ctx.member.title || CENTER_ROLE_LABEL[ctx.member.role]}
      accountHref="/kurum/hesap"
      headerActions={
        <Link href="/kurum/bildirimler" className="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label={unread ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}>
          <Bell className="size-5" aria-hidden />
          {unread ? <span className="absolute right-1 top-1 min-w-4 rounded-full bg-brand-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span> : null}
        </Link>
      }
      nav={nav}
      switchLinks={sideSwitches(facts, "center")}
      hideSiteLink
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
      <NotificationChannelProvider mode={settings.notificationChannel}>{children}</NotificationChannelProvider>
    </PanelShell>
  );
}

import { BookMarked, BookOpenCheck, CalendarHeart, LayoutDashboard, UserCog, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachPlanBanner } from "@/components/koc/plan-banner";
import { KocShell } from "@/components/koc/koc-shell";
import type { PanelNavItem } from "@/components/panel/nav-links";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { sideFacts } from "@/server/sides";

export const instant = false;

export const metadata: Metadata = { title: { template: "%s · Pi Koç", default: "Pi Koç" } };

// Pi Koç: bireysel koçun kendi paneli. Kurum hesabı buraya girerse kurum paneline döner.
export default async function KocLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCenter();
  // Hem kurum hem Pi Koç üyesi olan kişi (ör. kurumda da çalışan öğretmen): Pi Koç hesabına geçilir
  if (ctx.center.kind !== "COACH") redirect(ctx.memberships.some((m) => m.coach) ? "/panel-sec?taraf=koc" : "/kurum");
  const facts = await sideFacts(ctx.user.id, ctx.user.role);
  const [unread, active] = await Promise.all([
    db.notification.count({ where: { userId: ctx.user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "kurum")) } }),
    db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } }),
  ]);
  const nav: PanelNavItem[] = [
    { href: "/koc", label: "Genel bakış", icon: <LayoutDashboard />, exact: true },
    { href: "/koc/ogrenciler", label: "Öğrencilerim", icon: <Users /> },
    { href: "/koc/hafta", label: "Haftalık görüşmeler", icon: <CalendarHeart /> },
    { href: "/koc/denemeler", label: "Denemeler", icon: <BookOpenCheck /> },
    { href: "/koc/kaynaklar", label: "Kaynak kütüphanesi", icon: <BookMarked /> },
    { href: "/koc/tahsilat", label: "Tahsilat", icon: <Wallet /> },
    { href: "/koc/hesap", label: "Hesap ve abonelik", icon: <UserCog />, also: ["/koc/abonelik", "/koc/bildirimler"] },
  ];
  return (
    <KocShell user={ctx.user} nav={nav} switchLinks={sideSwitches(facts, "koc")} unread={unread} usage={{ active, limit: ctx.center.studentLimit }} banner={ctx.coach ? <CoachPlanBanner plan={ctx.coach} active={active} /> : null}>
      {children}
    </KocShell>
  );
}

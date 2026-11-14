import { BookMarked, BookOpenCheck, CalendarHeart, Crown, FileUp, LayoutDashboard, Map as MapIcon, School, Send, Sparkles, University, UserCog, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CoachPlanBanner } from "@/components/koc/plan-banner";
import { SidebarUpgrade } from "@/components/koc/premium";
import { OVER_LIMIT_GRACE_DAYS } from "@/server/koc-promo";
import { coachFeatureOpen, parseCoachTiers } from "@/lib/pi-koc";
import { getSiteSettings } from "@/server/site";
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
  const freePlan = Boolean(ctx.coach && !ctx.coach.paid);
  const now = new Date();
  const overLimitDaysLeft = ctx.center.overLimitSince ? Math.max(0, Math.ceil((ctx.center.overLimitSince.getTime() + OVER_LIMIT_GRACE_DAYS * 86_400_000 - now.getTime()) / 86_400_000)) : null;
  const nextTier = freePlan ? (parseCoachTiers((await getSiteSettings()).piKocTiers)[0] ?? null) : null;
  // Açık özellikler menüde; kilitli olanların hepsi altta tek grupta (ücretsiz pakette tıklayınca tanıtım/paketler)
  const tools: PanelNavItem[] = [
    // Tercih robotu ücretsiz pakette de açık (arama); öğrenci listesi ücretli
    { href: "/koc/lgs-tercih", label: "LGS tercih robotu", icon: <School /> },
    { href: "/koc/yks-tercih", label: "YKS tercih robotu", icon: <University /> },
    { href: "/koc/tahsilat", label: "Tahsilat", icon: <Wallet />, locked: !coachFeatureOpen(ctx.coach, "fees") },
  ];
  const locked: PanelNavItem[] = [
    ...tools.filter((t) => t.locked),
    ...(freePlan
      ? [
          { href: "/koc/abonelik#pdf", label: "PDF'ten deneme", icon: <FileUp />, locked: true },
          { href: "/koc/abonelik#konu", label: "Konu eksik haritası", icon: <MapIcon />, locked: true },
          { href: "/koc/abonelik#yz", label: "Yapay zekâ asistanı", icon: <Sparkles />, locked: true },
          { href: "/koc/abonelik#rapor", label: "Markalı veli raporu", icon: <Send />, locked: true },
        ]
      : []),
  ];
  const nav: PanelNavItem[] = [
    { href: "/koc", label: "Genel bakış", icon: <LayoutDashboard />, exact: true },
    { href: "/koc/ogrenciler", label: "Öğrencilerim", icon: <Users /> },
    { href: "/koc/hafta", label: "Haftalık görüşmeler", icon: <CalendarHeart /> },
    { href: "/koc/denemeler", label: "Denemeler", icon: <BookOpenCheck /> },
    { href: "/koc/kaynaklar", label: "Kaynak kütüphanesi", icon: <BookMarked /> },
    ...tools.filter((t) => !t.locked),
    { href: "/koc/abonelik", label: "Paketler", icon: <Crown />, accent: true, tag: freePlan ? "Yükselt" : undefined },
    { href: "/koc/hesap", label: "Hesap", icon: <UserCog />, also: ["/koc/bildirimler"] },
    ...locked.map((item) => ({ ...item, group: freePlan ? "Ücretli pakette" : "Üst pakette" })),
  ];
  return (
    <KocShell user={ctx.user} nav={nav} switchLinks={sideSwitches(facts, "koc")} unread={unread} usage={{ active, limit: ctx.center.studentLimit }} banner={ctx.coach ? <CoachPlanBanner plan={ctx.coach} active={active} overLimitDaysLeft={overLimitDaysLeft} /> : null} upgrade={freePlan ? <SidebarUpgrade next={nextTier} /> : undefined}>
      {children}
    </KocShell>
  );
}

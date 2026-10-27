import { Bell, Building2, LayoutDashboard, UserRound } from "lucide-react";
import { PanelShell } from "@/components/panel/panel-shell";
import type { PanelNavItem } from "@/components/panel/nav-links";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { sideFacts } from "@/server/sides";

export const instant = false;

/** Kurum tarafı (veli ve öğrenci portalı): yalnızca kurum bilgileri; özel ders menüsü burada yok. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  const facts = await sideFacts(user.id, user.role);
  const [unread, links] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "kurum")) } }),
    db.centerGuardian.findMany({
      where: { userId: user.id, student: { center: { status: { not: "SUSPENDED" } } } },
      select: { id: true, isStudentAccount: true, student: { select: { firstName: true, lastName: true } } },
      orderBy: { linkedAt: "asc" },
    }),
  ]);
  const onlyStudent = links.length > 0 && links.every((l) => l.isStudentAccount);
  const nav: PanelNavItem[] = [
    { href: "/hesabim/kurum", label: "Özet", icon: <LayoutDashboard />, exact: true },
    // Her bağlı öğrenci (velinin çocukları ya da öğrencinin kendisi) ayrı başlık
    ...links.map((l) => ({ href: `/hesabim/kurum/${l.id}`, label: l.isStudentAccount ? "Bilgilerim" : `${l.student.firstName} ${l.student.lastName}`, icon: <Building2 /> })),
    { href: "/hesabim/kurum/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
    { href: "/hesabim/kurum/hesap", label: "Hesap ayarları", icon: <UserRound /> },
  ];
  return (
    <PanelShell user={user} title="Kurumum" roleLabel={onlyStudent ? "Öğrenci" : "Veli"} nav={nav} switchLinks={sideSwitches(facts, "portal")} hideSiteLink>
      {children}
    </PanelShell>
  );
}

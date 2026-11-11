import { Bell, HeartHandshake, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { KocShell } from "@/components/koc/koc-shell";
import type { PanelNavItem } from "@/components/panel/nav-links";
import { notificationScope, notificationScopeWhere, sideSwitches } from "@/lib/sides";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { kocPortalLinks } from "@/server/koc";
import { sideFacts } from "@/server/sides";

export const instant = false;

export const metadata: Metadata = { title: { template: "%s · Pi Koç", default: "Pi Koç" } };

/** Pi Koç öğrencisi ve velisi: kurum portalından ayrı, koçluk ekranı. */
export default async function KocStudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("STUDENT");
  const facts = await sideFacts(user.id, user.role);
  const [unread, links] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(notificationScope(facts, "koc")) } }),
    kocPortalLinks(user.id),
  ]);
  const nav: PanelNavItem[] = [
    // Her bağlantı (öğrencinin kendisi ya da velinin çocukları) ayrı başlık
    ...links.map((l) => ({ href: `/kocum/${l.id}`, label: l.isStudentAccount ? "Koçluğum" : `${l.student.firstName} ${l.student.lastName}`, icon: <HeartHandshake /> })),
    { href: "/kocum/bildirimler", label: "Bildirimler", icon: <Bell />, badge: unread || undefined },
    { href: "/kocum/hesap", label: "Hesap ayarları", icon: <UserRound /> },
  ];
  return (
    <KocShell user={user} nav={nav} unread={unread} mode="student" roleLabel={links.length && links.every((l) => l.isStudentAccount) ? "Öğrenci" : "Veli"} switchLinks={sideSwitches(facts, "koc")}>
      {children}
    </KocShell>
  );
}

import { roleHome, type AppRole } from "./auth-constants";

// Tek hesap, iki taraf: kurum (etüt merkezi / dershane) ve özel ders. Kişi hangi kapıdan girerse o tarafı görür;
// o tarafta hiçbir şeyi yoksa kendi tarafına yönlenir. Veriler zaten ayrı; burada yalnızca açılış sayfası ve
// bildirimlerin hangi tarafta görüneceği belirlenir.

export type Side = "kurum" | "ozel";

export type SideFacts = {
  role: AppRole;
  /** Etkin kurum personeli üyeliği var (/kurum) */
  staff: boolean;
  /** Veli/öğrenci portalı bağlantısı var (/hesabim/kurum) */
  portal: boolean;
  /** Özel ders tarafı bu hesapta açık (kurumun açtığı ve özel derste işlemi olmayan öğrenci hesabında kapalı) */
  privateSide: boolean;
  /** Özel ders tarafında işlem yapmış (ders, kredi, paket, abonelik, grup dersi, soru, mesaj, favori) */
  privateActivity: boolean;
};

export const CENTER_NOTIFICATION_PREFIX = "center.";

export function kurumHome(f: SideFacts): string | null {
  if (f.staff) return "/kurum";
  if (f.portal && f.role === "STUDENT") return "/hesabim/kurum";
  return null;
}

function privateHome(f: SideFacts): string | null {
  if (f.role === "CENTER" || !f.privateSide) return null;
  return roleHome(f.role);
}

/** Girişten (ya da taraf değiştirince) açılacak sayfa. */
export function sideHome(f: SideFacts, side: Side): string {
  if (f.role === "ADMIN") return "/yonetim";
  const order = side === "kurum" ? [kurumHome(f), privateHome(f)] : [privateHome(f), kurumHome(f)];
  return order.find(Boolean) ?? roleHome(f.role);
}

export function sideOfPath(path: string): Side {
  const inside = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  return inside("/kurum") || inside("/hesabim/kurum") ? "kurum" : "ozel";
}

export type NotificationScope = "center" | "private" | "all";

/** O tarafta hangi bildirimler görünür: tek taraflı hesapta hepsi, iki taraflıda yalnızca o tarafın bildirimleri. */
export function notificationScope(f: SideFacts, side: Side): NotificationScope {
  if (f.role === "ADMIN") return "all";
  const both = Boolean(kurumHome(f)) && Boolean(privateHome(f));
  if (!both) return "all";
  return side === "kurum" ? "center" : "private";
}

export function notificationScopeWhere(scope: NotificationScope) {
  if (scope === "center") return { type: { startsWith: CENTER_NOTIFICATION_PREFIX } };
  if (scope === "private") return { NOT: { type: { startsWith: CENTER_NOTIFICATION_PREFIX } } };
  return {};
}

export function parseNotificationScope(value: unknown): NotificationScope {
  return value === "center" || value === "private" ? value : "all";
}

/** Panelin "diğer tarafa geç" bağlantıları. */
export type SideSwitch = { href: string; label: string; short: string };

export function sideSwitches(f: SideFacts, current: "teacher" | "student" | "center" | "portal"): SideSwitch[] {
  const links: SideSwitch[] = [];
  if (current === "teacher" && f.staff) links.push({ href: "/kurum", label: "Kurum paneline geç", short: "Kurum" });
  if (current === "student") {
    if (f.portal) links.push({ href: "/hesabim/kurum", label: "Kurum tarafına geç", short: "Kurum" });
    if (f.staff) links.push({ href: "/kurum", label: "Kurum paneline geç", short: "Kurum paneli" });
  }
  if (current === "center") {
    if (f.role === "TEACHER") links.push({ href: "/ogretmen-paneli", label: "Özel ders paneline geç", short: "Özel ders" });
    // Kurum personeli olan veli: özel ders tarafı ve (varsa) kendi veli portalı
    if (f.role === "STUDENT" && f.privateSide) links.push({ href: "/hesabim", label: "Özel ders tarafına geç", short: "Özel ders" });
    if (f.role === "STUDENT" && f.portal) links.push({ href: "/hesabim/kurum", label: "Veli / öğrenci portalı", short: "Portal" });
  }
  // Kurumun davet ettiği veliye özel dersi biz tanıtmayız: geçiş yalnızca özel derste işlemi olana görünür
  if (current === "portal") {
    if (f.privateActivity) links.push({ href: "/hesabim", label: "Özel ders tarafına geç", short: "Özel ders" });
    if (f.staff) links.push({ href: "/kurum", label: "Kurum paneline geç", short: "Kurum paneli" });
  }
  return links;
}

import { roleHome, type AppRole } from "./auth-constants";

// Tek hesap, üç kapı: özel ders, kurum (etüt merkezi) ve Pi Koç (bireysel koç ve öğrencileri). Kişi hangi kapıdan
// girerse o tarafı görür; o tarafta hiçbir şeyi yoksa kendi tarafına yönlenir. Veriler zaten ayrı; burada yalnızca
// açılış sayfası ve bildirimlerin hangi tarafta görüneceği belirlenir.

export type Side = "kurum" | "ozel" | "koc";

export type SideFacts = {
  role: AppRole;
  /** Etkin kurum personeli üyeliği var (/kurum); Pi Koç hesapları sayılmaz */
  staff: boolean;
  /** Veli/öğrenci portalı bağlantısı var (/hesabim/kurum); Pi Koç öğrencisi sayılmaz */
  portal: boolean;
  /** Pi Koç hesabının koçu (/koc) */
  kocStaff?: boolean;
  /** Pi Koç öğrencisi ya da velisi (/kocum) */
  kocStudent?: boolean;
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

export function kocHome(f: SideFacts): string | null {
  if (f.kocStaff) return "/koc";
  if (f.kocStudent && f.role === "STUDENT") return "/kocum";
  return null;
}

function privateHome(f: SideFacts): string | null {
  if (f.role === "CENTER" || !f.privateSide) return null;
  return roleHome(f.role);
}

/**
 * Giriş kapısının açacağı sayfa; kişinin o tarafı yoksa null (giriş yapılmaz, doğru kapı söylenir).
 * Özel ders tarafı: öğretmen ve kendi kayıt olan veli/öğrenci; kurumun ya da koçun açtığı öğrenci hesabında
 * (özel derste işlemi yoksa) özel ders tarafı yoktur. Yönetici her kapıdan yönetime girer.
 */
export function gateHome(f: SideFacts, side: Side): string | null {
  if (f.role === "ADMIN") return "/yonetim";
  if (side === "kurum") return kurumHome(f);
  if (side === "koc") return kocHome(f);
  return privateHome(f);
}

const SIDE_LABEL: Record<Side, string> = { ozel: "Özel ders", kurum: "Kurum", koc: "Pi Koç" };

/** Yanlış kapıdan girişte gösterilecek mesaj: kişinin hangi taraflarda hesabı var. */
export function wrongGateMessage(f: SideFacts, side: Side): string {
  const others = (["ozel", "kurum", "koc"] as Side[]).filter((s) => s !== side && gateHome(f, s));
  const where = others.map((s) => `“${SIDE_LABEL[s]}”`).join(" ya da ");
  return `Bu hesapla ${SIDE_LABEL[side]} tarafında kaydınız yok.${where ? ` Hesabınız ${others.map((s) => SIDE_LABEL[s]).join(" ve ")} tarafında: üstteki ${where} sekmesinden girin.` : ""}`;
}

/** Girişten (ya da taraf değiştirince) açılacak sayfa: önce girilen kapının tarafı, yoksa kişinin diğer tarafları. */
export function sideHome(f: SideFacts, side: Side): string {
  if (f.role === "ADMIN") return "/yonetim";
  const order =
    side === "koc" ? [kocHome(f), kurumHome(f), privateHome(f)] : side === "kurum" ? [kurumHome(f), kocHome(f), privateHome(f)] : [privateHome(f), kurumHome(f), kocHome(f)];
  return order.find(Boolean) ?? roleHome(f.role);
}

export function sideOfPath(path: string): Side {
  const inside = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  if (inside("/koc") || inside("/kocum")) return "koc";
  return inside("/kurum") || inside("/hesabim/kurum") ? "kurum" : "ozel";
}

export type NotificationScope = "center" | "private" | "all";

/** O tarafta hangi bildirimler görünür: tek taraflı hesapta hepsi, iki taraflıda yalnızca o tarafın bildirimleri. */
export function notificationScope(f: SideFacts, side: Side): NotificationScope {
  if (f.role === "ADMIN") return "all";
  // Kurum ve Pi Koç bildirimleri aynı türdedir (center.*)
  const both = Boolean(kurumHome(f) || kocHome(f)) && Boolean(privateHome(f));
  if (!both) return "all";
  return side === "ozel" ? "private" : "center";
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

/**
 * Hem kurum personeli hem Pi Koç koçu olan kişide seçili hesap çerezi değişmeli: geçiş /panel-sec rotasından yapılır
 * (doğrudan /koc ya da /kurum'a gidilirse düzen yönlendirir; sayfa içi gezinmede bu yönlendirme boş ekran bırakıyordu).
 */
export function staffPanelHref(f: SideFacts, side: "kurum" | "koc"): string {
  const home = side === "koc" ? "/koc" : "/kurum";
  return f.staff && f.kocStaff ? `/panel-sec?taraf=${side}` : home;
}

/** Tam sayfa yüklemesiyle açılması gereken adres (rota, sayfa değil) */
export function needsFullLoad(href: string): boolean {
  return href.startsWith("/panel-sec");
}

export function sideSwitches(f: SideFacts, current: "teacher" | "student" | "center" | "portal" | "koc"): SideSwitch[] {
  const links: SideSwitch[] = [];
  const toKoc = () => {
    const home = kocHome(f);
    if (home) links.push({ href: home === "/koc" ? staffPanelHref(f, "koc") : home, label: "Pi Koç'a geç", short: "Pi Koç" });
  };
  if (current === "teacher") {
    if (f.staff) links.push({ href: staffPanelHref(f, "kurum"), label: "Kurum paneline geç", short: "Kurum" });
    toKoc();
  }
  if (current === "student") {
    if (f.portal) links.push({ href: "/hesabim/kurum", label: "Kurum tarafına geç", short: "Kurum" });
    if (f.staff) links.push({ href: staffPanelHref(f, "kurum"), label: "Kurum paneline geç", short: "Kurum paneli" });
    toKoc();
  }
  if (current === "center") {
    if (f.role === "TEACHER") links.push({ href: "/ogretmen-paneli", label: "Özel ders paneline geç", short: "Özel ders" });
    // Kurum personeli olan veli: özel ders tarafı ve (varsa) kendi veli portalı
    if (f.role === "STUDENT" && f.privateSide) links.push({ href: "/hesabim", label: "Özel ders tarafına geç", short: "Özel ders" });
    if (f.role === "STUDENT" && f.portal) links.push({ href: "/hesabim/kurum", label: "Veli / öğrenci portalı", short: "Portal" });
    toKoc();
  }
  // Kurumun davet ettiği veliye özel dersi biz tanıtmayız: geçiş yalnızca özel derste işlemi olana görünür
  if (current === "portal") {
    if (f.privateActivity) links.push({ href: "/hesabim", label: "Özel ders tarafına geç", short: "Özel ders" });
    if (f.staff) links.push({ href: staffPanelHref(f, "kurum"), label: "Kurum paneline geç", short: "Kurum paneli" });
    toKoc();
  }
  // Pi Koç tarafı: koç olan özel ders öğretmeni ve kurum tarafı da olan kişi
  if (current === "koc") {
    if (f.role === "TEACHER") links.push({ href: "/ogretmen-paneli", label: "Özel ders paneline geç", short: "Özel ders" });
    if (f.role === "STUDENT" && f.privateActivity) links.push({ href: "/hesabim", label: "Özel ders tarafına geç", short: "Özel ders" });
    const kurum = kurumHome(f);
    if (kurum) links.push({ href: kurum === "/kurum" ? staffPanelHref(f, "kurum") : kurum, label: "Kurum tarafına geç", short: "Kurum" });
  }
  return links;
}

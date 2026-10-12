// Proxy ve sunucu kodunun ortak kullandığı sabitler (Node API'si içermez).

export const SESSION_COOKIE = "vd_session";

export const SESSION_TTL_DAYS = 30;

export const PROTECTED_PREFIXES = ["/yonetim", "/ogretmen-paneli", "/hesabim", "/kurum", "/ders", "/rezervasyon"];

/** CENTER: etüt merkezi / dershane personeli (kurum paneli) */
export type AppRole = "ADMIN" | "TEACHER" | "STUDENT" | "CENTER";

export function roleHome(role: AppRole): string {
  switch (role) {
    case "ADMIN":
      return "/yonetim";
    case "TEACHER":
      return "/ogretmen-paneli";
    case "CENTER":
      return "/kurum";
    default:
      return "/hesabim";
  }
}

/** Girişten sonra yönlendirilecek adresin site içi olduğundan emin olur. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

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

const NEXT_BASE = "https://site.invalid";

/** Girişten sonra yönlendirilecek adresin site içi olduğundan emin olur. */
export function safeNextPath(next: string | null | undefined): string | null {
  // Tarayıcı adresteki sekme ve satır sonlarını siler, ters bölüyü "/" sayar ("/\t/x.com" → "//x.com", dış site);
  // "/.//x.com" gibi nokta parçaları çözülünce de yol "//" ile başlayabilir.
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\p{Cc}]/u.test(next)) return null;
  try {
    const url = new URL(next, NEXT_BASE);
    if (url.origin !== NEXT_BASE || url.pathname.startsWith("//")) return null;
  } catch {
    return null;
  }
  return next;
}

import { hashToken, randomToken } from "../auth/password";
import { issueUserToken } from "../auth/tokens";
import { db } from "../db";
import { appUrl } from "../email";
import { ApiError } from "./http";

// Mobil uygulama oturumu: "Authorization: Bearer <anahtar>". Anahtarın yalnızca SHA-256 özeti
// Session tablosunda tutulur (web oturumlarıyla aynı tablo; userAgent "mobil: ..." ile başlar).

export const MOBILE_SESSION_DAYS = 90;
const WEB_LOGIN_TTL_MS = 5 * 60_000;

export type MobileUser = {
  id: string;
  role: "STUDENT" | "TEACHER";
  firstName: string;
  lastName: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  mustChangePassword: boolean;
  emailVerified: boolean;
  sessionId: string;
};

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

export async function issueMobileSession(userId: string, request: Request, deviceName?: string | null): Promise<string> {
  const token = randomToken();
  const device = (deviceName?.trim() || request.headers.get("user-agent") || "uygulama").slice(0, 180);
  await db.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + MOBILE_SESSION_DAYS * 86_400_000),
      ipAddress: clientIp(request),
      userAgent: `mobil: ${device}`,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return token;
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

/** Yalnızca oturum açmış veli/öğrenci ve öğretmenler; yöneticiler web panelini kullanır. */
export async function authenticate(request: Request, options: { allowPasswordChange?: boolean } = {}): Promise<MobileUser> {
  const token = bearerToken(request);
  if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Oturum açmanız gerekiyor.");
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await db.session.deleteMany({ where: { id: session.id } });
    throw new ApiError(401, "UNAUTHENTICATED", "Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.");
  }
  const { user } = session;
  if (user.status !== "ACTIVE") throw new ApiError(403, "ACCOUNT_SUSPENDED", "Hesabınız askıya alınmış. Destek ekibimizle iletişime geçin.");
  if (user.role === "ADMIN") throw new ApiError(403, "ADMIN_NOT_SUPPORTED", "Yönetici hesabı mobil uygulamada kullanılamaz; web panelini kullanın.");
  if (user.role === "CENTER") throw new ApiError(403, "CENTER_NOT_SUPPORTED", "Kurum paneli hesabı mobil uygulamada henüz kullanılamıyor; web panelini kullanın.");
  if (user.mustChangePassword && !options.allowPasswordChange) {
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Devam etmeden önce size verilen geçici şifreyi değiştirmeniz gerekiyor.");
  }
  return {
    id: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    mustChangePassword: user.mustChangePassword,
    emailVerified: Boolean(user.emailVerifiedAt),
    sessionId: session.id,
  };
}

/** Anahtar varsa ve geçerliyse kullanıcı, yoksa null (herkese açık uç noktalarda kişiselleştirme için). */
export async function optionalUser(request: Request): Promise<MobileUser | null> {
  if (!bearerToken(request)) return null;
  try {
    return await authenticate(request, { allowPasswordChange: true });
  } catch {
    return null;
  }
}

export function requireRole(user: MobileUser, role: MobileUser["role"]): void {
  if (user.role !== role) {
    throw new ApiError(403, "FORBIDDEN", role === "TEACHER" ? "Bu işlem yalnızca öğretmenler içindir." : "Bu işlem yalnızca veli/öğrenci hesapları içindir.");
  }
}

// ---------------------------------------------------------------------------
// WebView için tek kullanımlık web girişi (ödeme formu ve sanal sınıf sitede açılır)
// ---------------------------------------------------------------------------

/** Öğretmenin uygulamada açabildiği web paneli sayfaları (profil, fotoğraf, fiyatlar, belgeler, IBAN). */
export const TEACHER_PANEL_TARGETS = ["/ogretmen-paneli/profil", "/ogretmen-paneli/dersler-ve-fiyatlar", "/ogretmen-paneli/belgeler", "/ogretmen-paneli/kazanclar"];

const WEB_LOGIN_TARGETS = [
  /^\/ders\/[a-z0-9]+$/i,
  /^\/odeme\/(paytr|test)\/[a-z0-9]+$/i,
  /^\/odeme\/sonuc\/[a-z0-9]+$/i,
  ...TEACHER_PANEL_TARGETS.map((path) => new RegExp(`^${path}$`)),
];

export function isWebLoginTarget(path: string): boolean {
  return WEB_LOGIN_TARGETS.some((pattern) => pattern.test(path));
}

/** 5 dakika geçerli, tek kullanımlık bağlantı: açılınca WebView'da web oturumu kurulur ve hedefe gidilir. */
export async function webLoginLink(userId: string, target: string): Promise<string> {
  if (!isWebLoginTarget(target)) throw new Error(`Geçersiz web giriş hedefi: ${target}`);
  const token = await issueUserToken(userId, "MOBILE_WEB_LOGIN", WEB_LOGIN_TTL_MS);
  return appUrl(`/api/mobil/v1/web-giris?${new URLSearchParams({ t: token, next: target })}`);
}

/** Ödeme sağlayıcısının yönlendirme adresi: site içi sayfalar tek kullanımlık girişle açılır. */
export async function paymentLink(userId: string, redirectUrl: string): Promise<string> {
  return redirectUrl.startsWith("/") ? webLoginLink(userId, redirectUrl) : redirectUrl;
}

/** Uygulama, WebView bu adresle başlayan bir sayfaya gidince ödeme ekranını kapatıp sonucu API'den sorar. */
export function paymentReturnPrefix(): string {
  return appUrl("/odeme/sonuc/");
}

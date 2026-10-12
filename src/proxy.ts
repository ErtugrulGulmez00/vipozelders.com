import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, SESSION_COOKIE } from "@/lib/auth-constants";
import { isAdminSession, maintenanceHtml, maintenanceState } from "@/server/maintenance";

/** Bakım modunda kapanan vitrin sayfaları. Paneller, sanal sınıf, giriş ve ödeme dönüşleri açık kalır. */
const MAINTENANCE_PREFIXES = ["/ogretmenler", "/ogretmen/", "/ogretmen-ol", "/ozel-ders", "/sayfa/", "/rezervasyon", "/odeme/test", "/kayit"];

function isMaintenanceGated(pathname: string): boolean {
  return pathname === "/" || MAINTENANCE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), geolocation=()");
  return response;
}

/**
 * İyimser kontrol: oturum çerezi olmayanı panellerden giriş sayfasına yönlendirir.
 * Asıl yetki kontrolü her sayfada ve her Server Action'da sunucu tarafında yapılır.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !sessionToken) {
    const url = new URL("/giris", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (request.method === "GET" && isMaintenanceGated(pathname)) {
    try {
      const state = await maintenanceState();
      if (state.on && !(await isAdminSession(sessionToken))) {
        return withSecurityHeaders(
          new NextResponse(maintenanceHtml(state), {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8", "Retry-After": "1800", "Cache-Control": "no-store" },
          }),
        );
      }
    } catch {
      // Ayar okunamazsa siteyi kapatmak yerine açık bırak.
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/dosya).*)"],
};

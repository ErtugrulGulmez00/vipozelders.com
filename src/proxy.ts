import { NextResponse, type NextRequest } from "next/server";
import { PROTECTED_PREFIXES, SESSION_COOKIE } from "@/lib/auth-constants";
import { isAdminSession, maintenanceHtml, maintenanceState } from "@/server/maintenance";

/** Bakım modunda kapanan vitrin sayfaları. Paneller, sanal sınıf, giriş ve ödeme dönüşleri açık kalır. */
const MAINTENANCE_PREFIXES = ["/ogretmenler", "/ogretmen/", "/ogretmen-ol", "/ozel-ders", "/sayfa/", "/rezervasyon", "/odeme/test", "/kayit", "/kurumlar", "/kurumlar-icin"];

function isMaintenanceGated(pathname: string): boolean {
  return pathname === "/" || MAINTENANCE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), display-capture=(self), geolocation=()");
  // Temel CSP: eklenti nesnesi, başka köke <base> ve başka sitenin çerçevesi yok (betik kaynakları ayrıca daraltılabilir)
  response.headers.set("Content-Security-Policy", "object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  return response;
}

/**
 * İyimser kontrol: oturum çerezi olmayanı panellerden giriş sayfasına yönlendirir.
 * Asıl yetki kontrolü her sayfada ve her Server Action'da sunucu tarafında yapılır.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  // kurum.<alan adı> alt adresi aynı uygulamaya yönlenir; ana sayfası kurum girişi / kurum panelidir.
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("kurum.") && pathname === "/") {
    return NextResponse.redirect(new URL(sessionToken ? "/kurum" : "/kurum-giris", request.url));
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isProtected && !sessionToken) {
    const under = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
    // Her taraf kendi giriş kapısına gider: kurum paneli → kurum girişi, Pi Koç (koç ve öğrencisi) → Pi Koç girişi
    const gate = under("/kurum") ? "/kurum-giris" : under("/koc") || under("/kocum") || under("/gorusme") ? "/koc-giris" : "/giris";
    const isCenterPanel = gate !== "/giris";
    const url = new URL(gate, request.url);
    if (!isCenterPanel || !["/kurum", "/koc", "/kocum"].includes(pathname)) url.searchParams.set("next", `${pathname}${search}`);
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

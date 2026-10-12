import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/server/auth/session";
import { consumeUserToken } from "@/server/auth/tokens";
import { appUrl } from "@/server/email";
import { isWebLoginTarget } from "@/server/mobile/auth";

/**
 * Mobil uygulamanın WebView'da (ödeme formu, sanal sınıf) açtığı tek kullanımlık bağlantı:
 * anahtar geçerliyse web oturumu açılır ve hedef sayfaya gidilir; değilse giriş sayfası açılır.
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "";
  const target = isWebLoginTarget(next) ? next : "/";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const userId = token ? await consumeUserToken(token, "MOBILE_WEB_LOGIN") : null;
  if (!userId) return NextResponse.redirect(appUrl(`/giris?next=${encodeURIComponent(target)}`), 303);
  await createSession(userId);
  return NextResponse.redirect(appUrl(target), 303);
}

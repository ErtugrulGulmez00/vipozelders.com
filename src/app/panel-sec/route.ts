import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth-constants";
import { resolveCenter, selectCenterCookie } from "@/server/center/context";

// Hem kurum hem Pi Koç üyesi olan kişinin taraf geçişi: seçili hesap çerezini o tarafın hesabına çevirip panele yönlendirir.
export async function GET(request: NextRequest) {
  const side = request.nextUrl.searchParams.get("taraf") === "koc" ? "koc" : "kurum";
  const resolved = await resolveCenter();
  if (resolved.kind !== "ok") return NextResponse.redirect(new URL(side === "koc" ? "/koc-giris" : "/kurum-giris", request.url));
  const target = resolved.ctx.memberships.find((m) => m.coach === (side === "koc"));
  // Bu tarafta hesabı yoksa diğer tarafına döner (yönlendirme döngüsü olmaz)
  if (!target) return NextResponse.redirect(new URL(side === "koc" ? "/kurum" : "/koc", request.url));
  await selectCenterCookie(target.centerId);
  // İsteğe bağlı hedef: yalnızca o tarafın sayfaları
  const home = side === "koc" ? "/koc" : "/kurum";
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(next && (next === home || next.startsWith(`${home}/`)) ? next : home, request.url));
}

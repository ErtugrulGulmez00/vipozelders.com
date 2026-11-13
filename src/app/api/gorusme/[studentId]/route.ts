import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { meetingAccess, meetingLive } from "@/server/koc-meeting";

/** Öğrencinin "Görüşmeye katıl" düğmesi: koç görüşmeyi başlattı mı (düğme aralıklarla sorar). */
export async function GET(_request: Request, ctx: RouteContext<"/api/gorusme/[studentId]">) {
  const { studentId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ live: false }, { status: 401 });
  const access = await meetingAccess(user.id, studentId);
  if (!access.ok) return NextResponse.json({ live: false }, { status: 404 });
  return NextResponse.json({ live: await meetingLive(studentId) }, { headers: { "Cache-Control": "no-store" } });
}

import { NextResponse, type NextRequest } from "next/server";
import { recordPageView } from "@/server/stats";

/** Çerezsiz sayfa görüntüleme sayacı (vitrin sayfaları). Gövde: { path, referrer }. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { path?: unknown; referrer?: unknown } | null;
    if (body && typeof body.path === "string") {
      await recordPageView({
        path: body.path,
        referrer: typeof body.referrer === "string" ? body.referrer : null,
        userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? "",
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
        ownHost: request.nextUrl.hostname,
      });
    }
  } catch (error) {
    console.error("[istatistik]", error);
  }
  return new NextResponse(null, { status: 204 });
}

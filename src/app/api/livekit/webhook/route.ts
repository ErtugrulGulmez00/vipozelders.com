import { NextResponse, type NextRequest } from "next/server";
import { handleLiveKitWebhook } from "@/server/video";

/** LiveKit sunucusunun katılım olayları (yoklama). İmza LiveKit API anahtarıyla doğrulanır. */
export async function POST(request: NextRequest) {
  const body = await request.text();
  try {
    await handleLiveKitWebhook(body, request.headers.get("authorization"));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[livekit webhook]", error);
    return NextResponse.json({ ok: false }, { status: 401 });
  }
}

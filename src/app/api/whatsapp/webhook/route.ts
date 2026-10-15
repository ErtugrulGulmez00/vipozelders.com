import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { notifyRole } from "@/server/notifications";

// Meta WhatsApp webhook: GET = adres doğrulama, POST = mesaj durumları (iletildi/okundu/başarısız) ve gelen mesajlar.

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Doğrulama başarısız", { status: 403 });
}

/** X-Hub-Signature-256: uygulama gizli anahtarıyla gövdenin HMAC-SHA256'sı. Anahtar tanımlı değilse istek kabul edilmez. */
function validSignature(body: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const received = Buffer.from(header.slice(7));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        statuses?: { id: string; status: string; recipient_id: string; errors?: { code: number; title: string }[] }[];
        messages?: { from: string; type: string; text?: { body: string } }[];
        contacts?: { wa_id: string; profile?: { name?: string } }[];
      };
    }[];
  }[];
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!validSignature(body, request.headers.get("x-hub-signature-256"))) return new NextResponse("İmza geçersiz", { status: 401 });
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body) as WebhookPayload;
  } catch {
    return new NextResponse("Geçersiz istek", { status: 400 });
  }
  for (const change of payload.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    const value = change.value;
    for (const status of value?.statuses ?? []) {
      if (status.status === "failed") console.warn(`[whatsapp] ${status.id} iletilemedi: ${status.errors?.map((e) => `${e.code} ${e.title}`).join(", ")}`);
    }
    for (const message of value?.messages ?? []) {
      // Velinin/öğrencinin cevabı: yöneticiye site içi bildirim (yanıt ileride panelden verilecek)
      const name = value?.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
      await notifyRole("ADMIN", {
        type: "whatsapp.incoming",
        title: `WhatsApp mesajı: ${name ?? `+${message.from}`}`,
        body: message.text?.body?.slice(0, 300) ?? `(${message.type} mesajı)`,
        email: false,
      });
    }
  }
  return NextResponse.json({ ok: true });
}

// WhatsApp Business Cloud API (Meta). Ayarlar: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID.
// İşletmenin başlattığı mesajlar yalnızca Meta onaylı şablonlarla gönderilebilir.

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** 05XXXXXXXXX / 5XXXXXXXXX / +905XXXXXXXXX → 905XXXXXXXXX (WhatsApp uluslararası biçim) */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^905\d{9}$/.test(digits)) return digits;
  if (/^05\d{9}$/.test(digits)) return `9${digits}`;
  if (/^5\d{9}$/.test(digits)) return `90${digits}`;
  return null;
}

export type WhatsAppResult = { ok: true; messageId: string } | { ok: false; error: string };

/** Onaylı şablonla mesaj gönderir. params: şablondaki {{1}}, {{2}}… değerleri (gövde). */
export async function sendWhatsAppTemplate(phone: string, template: string, language = "tr", params: string[] = []): Promise<WhatsAppResult> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp ayarları girilmemiş." };
  const to = toWhatsAppNumber(phone);
  if (!to) return { ok: false, error: "Geçersiz telefon numarası." };
  try {
    const response = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: language },
          ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}),
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    if (!response.ok || !data.messages?.[0]) return { ok: false, error: `${data.error?.code ?? response.status}: ${data.error?.message ?? "WhatsApp mesajı gönderilemedi"}`.slice(0, 300) };
    return { ok: true, messageId: data.messages[0].id };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 300) };
  }
}

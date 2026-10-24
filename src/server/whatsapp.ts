// WhatsApp bildirimleri. Gönderim LetsBot API ile yapılır (LETSBOT_API_KEY): şablon gerekmez, düz metin gider.
// LetsBot panelinde işletmenin WhatsApp numarası "bağlı cihaz" olarak eklenmiş olmalı (QR ile).
// Bildirimler önce WhatsAppMessage kuyruğuna yazılır; zamanlayıcı dakikada sınırlı sayıda gönderir.
// Yedek: Meta WhatsApp Business Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID), yalnızca onaylı şablonlarla.

import { db } from "./db";

const LETSBOT = "https://letsbot.net/api/v1";
const GRAPH = "https://graph.facebook.com/v21.0";
/** Dakikada en fazla gönderim (numaranın spam sayılmaması için) */
const PER_MINUTE = 20;
const MAX_ATTEMPTS = 3;

export function letsbotConfigured(): boolean {
  return Boolean(process.env.LETSBOT_API_KEY);
}

export function whatsappConfigured(): boolean {
  return letsbotConfigured() || Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
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

async function letsbot(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${LETSBOT}/${path}`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${process.env.LETSBOT_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; data?: { id?: string; key?: { id?: string } } | unknown[] };
  return { response, data };
}

/** Düz metin WhatsApp mesajı (LetsBot). */
export async function sendWhatsAppText(phone: string, body: string): Promise<WhatsAppResult> {
  if (!letsbotConfigured()) return { ok: false, error: "LetsBot API anahtarı girilmemiş." };
  const to = toWhatsAppNumber(phone);
  if (!to) return { ok: false, error: "Geçersiz telefon numarası." };
  try {
    const { response, data } = await letsbot("message/send", { phone: to, body });
    if (!response.ok || data.success === false) return { ok: false, error: `${response.status}: ${data.message ?? "WhatsApp mesajı gönderilemedi"}`.slice(0, 300) };
    const info = Array.isArray(data.data) ? undefined : data.data;
    return { ok: true, messageId: info?.id ?? info?.key?.id ?? "" };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 300) };
  }
}

/** LetsBot'ta WhatsApp oturumu (bağlı numara) açık mı? Mesaj göndermez. */
export async function whatsappSessionStatus(): Promise<{ ok: boolean; message: string }> {
  if (!letsbotConfigured()) return { ok: false, message: "LetsBot API anahtarı girilmemiş." };
  try {
    const { response, data } = await letsbot("session/status", {});
    return { ok: response.ok && data.success !== false, message: data.message ?? String(response.status) };
  } catch (error) {
    return { ok: false, message: String(error).slice(0, 200) };
  }
}

/** Onaylı şablonla mesaj (Meta Cloud API, yedek yol). params: şablondaki {{1}}, {{2}}… değerleri. */
export async function sendWhatsAppTemplate(phone: string, template: string, language = "tr", params: string[] = []): Promise<WhatsAppResult> {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return { ok: false, error: "WhatsApp ayarları girilmemiş." };
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

/** Kuyruktaki WhatsApp mesajlarını gönderir (zamanlayıcı). LetsBot ayarlı değilse kuyruk bekler. */
export async function sendPendingWhatsApps(now = new Date()): Promise<number> {
  if (!letsbotConfigured()) return 0;
  const pending = await db.whatsAppMessage.findMany({ where: { status: "PENDING", attempts: { lt: MAX_ATTEMPTS } }, orderBy: { createdAt: "asc" }, take: PER_MINUTE });
  let sent = 0;
  for (const message of pending) {
    // Bir saatten eski bildirim artık anlamını yitirmiştir (ör. "1 saat sonra dersiniz var")
    if (now.getTime() - message.createdAt.getTime() > 3_600_000) {
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "FAILED", error: "Süresi geçti, gönderilmedi" } });
      continue;
    }
    const result = await sendWhatsAppText(message.to, message.body);
    const attempts = message.attempts + 1;
    await db.whatsAppMessage.update({
      where: { id: message.id },
      data: result.ok
        ? { status: "SENT", sentAt: now, attempts, error: null, providerId: result.messageId || null }
        : { attempts, status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING", error: result.error },
    });
    if (result.ok) sent++;
  }
  return sent;
}

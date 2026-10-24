// WhatsApp bildirimleri. Gönderim LetsBot API ile yapılır (LETSBOT_API_KEY); kanal resmî WhatsApp Cloud API'dir.
// Meta kuralı: işletmenin başlattığı mesaj onaylı şablonla gider; düz metin yalnızca kişi son 24 saatte yazdıysa
// ulaşır. Site ayarlarında şablon adı girildiyse bildirimler şablonla (değişkenler: başlık, metin, bağlantı) gider.
// Bildirimler önce WhatsAppMessage kuyruğuna yazılır; zamanlayıcı dakikada sınırlı sayıda gönderir.
// Yedek: Meta WhatsApp Business Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID), yalnızca onaylı şablonlarla.

import { db } from "./db";
import { loadSettings } from "./settings";

const LETSBOT = "https://letsbot.net/api/v1";
const GRAPH = "https://graph.facebook.com/v21.0";
/** Dakikada en fazla gönderim (kurum duyurularında yüzlerce veli olabilir) */
const PER_MINUTE = 60;
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
  const data = (await response.json().catch(() => ({}))) as { success?: boolean; Status?: boolean; message?: string; Message?: string; data?: { id?: string; key?: { id?: string } } | unknown[] };
  return { response, data };
}

/** Şablon değişkeni: Meta yeni satır, sekme ve 4'ten fazla boşluk kabul etmez. */
function templateParam(text: string) {
  return text.replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim().slice(0, 900) || "-";
}

/** Onaylı şablonla mesaj (LetsBot → Meta). params: gövdedeki {{1}}, {{2}}… değerleri. */
export async function sendLetsbotTemplate(phone: string, template: string, language: string, params: string[]): Promise<WhatsAppResult> {
  if (!letsbotConfigured()) return { ok: false, error: "LetsBot API anahtarı girilmemiş." };
  const to = toWhatsAppNumber(phone);
  if (!to) return { ok: false, error: "Geçersiz telefon numarası." };
  try {
    const { response, data } = await letsbot("template/send", {
      phone: to,
      template_name: template,
      template_language: language,
      components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text: templateParam(text) })) }] : [],
    });
    if (!response.ok || data.success === false || data.Status === false) return { ok: false, error: `${response.status}: ${data.message ?? data.Message ?? "Şablon mesajı gönderilemedi"}`.slice(0, 300) };
    const info = Array.isArray(data.data) ? undefined : data.data;
    return { ok: true, messageId: info?.id ?? info?.key?.id ?? "" };
  } catch (error) {
    return { ok: false, error: String(error).slice(0, 300) };
  }
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

/** LetsBot anahtarı ve kanal çalışıyor mu? Son mesajlar okunarak denetlenir; mesaj göndermez. */
export async function whatsappSessionStatus(): Promise<{ ok: boolean; message: string }> {
  if (!letsbotConfigured()) return { ok: false, message: "LetsBot API anahtarı girilmemiş." };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(`${LETSBOT}/messages?date_from=${today}&date_to=${today}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${process.env.LETSBOT_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => ({}))) as { Status?: boolean; Message?: string; message?: string };
    return { ok: response.ok && data.Status !== false, message: data.Message ?? data.message ?? String(response.status) };
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
  if (!pending.length) return 0;
  const settings = await loadSettings();
  const template = settings.whatsappTemplateName.trim();
  let sent = 0;
  for (const message of pending) {
    // Bir saatten eski bildirim artık anlamını yitirmiştir (ör. "1 saat sonra dersiniz var"); kurum mesajları 12 saat bekleyebilir
    const maxAge = message.type?.startsWith("center.") ? 12 * 3_600_000 : 3_600_000;
    if (now.getTime() - message.createdAt.getTime() > maxAge) {
      await db.whatsAppMessage.update({ where: { id: message.id }, data: { status: "FAILED", error: "Süresi geçti, gönderilmedi" } });
      continue;
    }
    const params = Array.isArray(message.params) ? (message.params as string[]) : null;
    const result = template && params ? await sendLetsbotTemplate(message.to, template, settings.whatsappTemplateLanguage || "tr", params) : await sendWhatsAppText(message.to, message.body);
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

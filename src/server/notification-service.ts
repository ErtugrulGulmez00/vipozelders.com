import { planChannels, type ChannelMode } from "@/lib/notification-channels";
import { db, type DbTransaction } from "./db";
import { renderEmail } from "./email";
import { loadSettings } from "./settings";

// Dış bildirim kanalları (adapter): her kanal mesajı kendi kuyruğuna yazar, gönderimi zamanlayıcı yapar
// (sendPendingEmails, sendPendingWhatsApps). Hangi kanalın kullanılacağına strateji karar verir (planChannels).
// Özel ders tarafı notify() ile, kurum tarafı messageGuardians() ile bu servisi kullanır.

type Tx = DbTransaction | typeof db;

export type DeliveryChannel = "email" | "whatsapp";

export interface ChannelAdapter<M> {
  readonly channel: DeliveryChannel;
  /** Mesajı kuyruğa yazar; kuyruk kaydının kimliği ve geçmişte gösterilecek metin döner. */
  enqueue(tx: Tx, message: M): Promise<{ id: string; text: string }>;
}

export type EmailOutbound = {
  userId?: string | null;
  to: string;
  subject: string;
  /** E-postanın üst bilgisinde görünen ad (site ya da kurum adı) */
  senderName: string;
  greetingName?: string;
  title: string;
  lines: string[];
  action?: { label: string; url: string };
};

export const emailChannel: ChannelAdapter<EmailOutbound> = {
  channel: "email",
  async enqueue(tx, m) {
    const { html, text } = renderEmail({ siteName: m.senderName, greetingName: m.greetingName, title: m.title, lines: m.lines, action: m.action });
    const row = await tx.emailMessage.create({ data: { userId: m.userId ?? null, to: m.to, subject: m.subject, html, text } });
    return { id: row.id, text };
  },
};

export type WhatsAppOutbound = {
  userId?: string | null;
  to: string;
  /** Şablonsuz gönderimde (ve geçmişte) kullanılan düz metin */
  body: string;
  /** Meta onaylı şablon; yoksa site ayarındaki genel şablon ya da düz metin */
  template?: string | null;
  params: string[];
  type: string;
};

export const whatsappChannel: ChannelAdapter<WhatsAppOutbound> = {
  channel: "whatsapp",
  async enqueue(tx, m) {
    const body = m.body.slice(0, 1500);
    const row = await tx.whatsAppMessage.create({ data: { userId: m.userId ?? null, to: m.to, body, template: m.template ?? null, params: m.params, type: m.type } });
    return { id: row.id, text: body };
  },
};

export const NotificationService = {
  /** Şu anki kanal ayarı (Site ayarları → Bildirim kanalı). */
  async mode(): Promise<ChannelMode> {
    return (await loadSettings()).notificationChannel;
  },
  plan: planChannels,
  email: emailChannel,
  whatsapp: whatsappChannel,
};

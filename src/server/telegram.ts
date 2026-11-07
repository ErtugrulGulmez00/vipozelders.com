// Yönetici bildirimlerinin Telegram kopyası. Bot anahtarı ve sohbet kimlikleri .env'de (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
// virgülle birden fazla sohbet); boşsa hiçbir şey gönderilmez. Zamanlayıcı dakikada bir yönetici hesaplarına düşen yeni
// bildirimleri gönderir; bildirim hangi yoldan oluşursa oluşsun (notifyRole, doğrudan kayıt) kopyası gider.

import { db } from "./db";
import { appUrl } from "./email";

/** Telegram açılmadan önce birikmiş eski bildirimler gönderilmez. */
const WINDOW_MS = 30 * 60_000;

function chatIds(): string[] {
  return (process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN) && chatIds().length > 0;
}

type TelegramReply = { ok?: boolean; description?: string; parameters?: { migrate_to_chat_id?: number } };

async function postMessage(token: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  return { response, data: (await response.json().catch(() => ({}))) as TelegramReply };
}

/** Ayarlı bütün sohbetlere düz metin mesaj; en az birine gittiyse başarılı sayılır. */
export async function sendTelegram(text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !telegramConfigured()) return { ok: false, error: "Telegram bot anahtarı ya da sohbet kimliği girilmemiş." };
  const errors: string[] = [];
  let sent = 0;
  for (const chatId of chatIds()) {
    try {
      let { response, data } = await postMessage(token, chatId, text);
      // Grup süper gruba yükseltilince kimlik değişir; Telegram yenisini bildirir, mesaj ona gönderilir
      const moved = data.parameters?.migrate_to_chat_id;
      if (!response.ok && moved) {
        console.warn(`[telegram] sohbet süper gruba taşınmış; TELEGRAM_CHAT_ID'yi ${moved} yapın`);
        ({ response, data } = await postMessage(token, String(moved), text));
      }
      if (response.ok && data.ok !== false) sent++;
      else errors.push(`${response.status}: ${data.description ?? "gönderilemedi"}`);
    } catch (error) {
      errors.push(String(error));
    }
  }
  // Hata metninde bot anahtarı geçerse gizlenir (sunucu kayıtlarına ve ekrana düşmesin)
  return sent ? { ok: true } : { ok: false, error: errors.join("; ").replaceAll(token, "***").slice(0, 300) };
}

/** Zamanlayıcı görevi: yönetici hesaplarına son 30 dakikada düşen, henüz gönderilmemiş bildirimleri Telegram'a yollar. */
export async function sendPendingTelegrams(now = new Date(), limit = 50): Promise<number> {
  if (!telegramConfigured()) return 0;
  const pending = await db.notification.findMany({
    where: { telegramSentAt: null, createdAt: { gte: new Date(now.getTime() - WINDOW_MS) }, user: { role: "ADMIN" } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (!pending.length) return 0;
  // Gönderimden önce işaretlenir: hata olursa aynı bildirim her dakika yeniden gitmez
  await db.notification.updateMany({ where: { id: { in: pending.map((n) => n.id) } }, data: { telegramSentAt: now } });

  // Birden fazla yönetici aynı olay için ayrı bildirim alır; Telegram'a bir kez gider
  const seen = new Set<string>();
  let sent = 0;
  for (const notification of pending) {
    const key = [notification.type, notification.title, notification.body, notification.link].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const text = [`🔔 ${notification.title}`, notification.body, notification.link ? appUrl(notification.link) : null].filter(Boolean).join("\n");
    const result = await sendTelegram(text);
    if (result.ok) sent++;
    else console.error(`[telegram] ${result.error}`);
  }
  return sent;
}

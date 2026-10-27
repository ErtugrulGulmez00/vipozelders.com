import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { db } from "./db";
import { notificationTarget } from "./mobile/serialize";

/**
 * Mobil push bildirimleri (Firebase Cloud Messaging HTTP v1). Firebase konsolundan indirilen
 * servis hesabı JSON dosyasının yolu FCM_SERVICE_ACCOUNT_FILE ile verilir; tanımlı değilse hiçbir şey gönderilmez.
 * Site içi bildirimler oluşturulduktan sonra zamanlayıcı her dakika yeni olanları cihazlara iletir.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let account: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

const PUSH_WINDOW_MS = 30 * 60_000;

function serviceAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const file = process.env.FCM_SERVICE_ACCOUNT_FILE;
  if (!file) return (account = null);
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<ServiceAccount>;
    account = parsed.project_id && parsed.client_email && parsed.private_key ? (parsed as ServiceAccount) : null;
    if (!account) console.error("[push] servis hesabı dosyasında project_id, client_email veya private_key eksik.");
  } catch (error) {
    console.error("[push] servis hesabı dosyası okunamadı:", error);
    account = null;
  }
  return account;
}

/** Google OAuth için RS256 imzalı servis hesabı JWT'si. */
export function serviceAccountJwt(sa: ServiceAccount, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceAccountJwt(sa) }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) throw new Error(`FCM yetkilendirme hatası: ${data.error ?? response.status}`);
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

type PushNotification = { id: string; type: string; title: string; body: string; link: string | null };

/** FCM mesajı: başlık/metin + uygulamanın açacağı ekran (data alanları metin olmalı). */
export function pushMessage(deviceToken: string, notification: PushNotification) {
  const target = notificationTarget(notification.link);
  return {
    message: {
      token: deviceToken,
      notification: { title: notification.title, body: notification.body.slice(0, 240) },
      data: { notificationId: notification.id, type: notification.type, link: notification.link ?? "", screen: target?.screen ?? "", targetId: target?.id ?? "" },
      android: { priority: "HIGH" },
      apns: { payload: { aps: { sound: "default" } } },
    },
  };
}

/** Son 30 dakikadaki, henüz gönderilmemiş bildirimleri cihazlara iletir. Geçersiz cihaz anahtarları silinir. */
export async function sendPendingPushes(now = new Date(), limit = 100): Promise<number> {
  const sa = serviceAccount();
  if (!sa) return 0;
  const pending = await db.notification.findMany({
    where: { pushedAt: null, createdAt: { gte: new Date(now.getTime() - PUSH_WINDOW_MS) }, user: { devices: { some: {} } } },
    include: { user: { select: { devices: { select: { id: true, token: true } } } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (!pending.length) return 0;

  // Yetki alınamazsa bildirimler kuyrukta kalır, sonraki dakikada yeniden denenir.
  const token = await accessToken(sa);
  await db.notification.updateMany({ where: { id: { in: pending.map((n) => n.id) } }, data: { pushedAt: now } });

  let sent = 0;
  for (const notification of pending) {
    for (const device of notification.user.devices) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(pushMessage(device.token, notification)),
        signal: AbortSignal.timeout(15_000),
      }).catch((error: unknown) => {
        console.error("[push] gönderilemedi:", error);
        return null;
      });
      if (!response) continue;
      if (response.ok) {
        sent++;
        continue;
      }
      const detail = await response.text().catch(() => "");
      if (response.status === 404 || /UNREGISTERED|not a valid FCM registration token/i.test(detail)) {
        await db.device.deleteMany({ where: { id: device.id } });
      } else {
        console.error(`[push] FCM ${response.status}: ${detail.slice(0, 300)}`);
      }
    }
  }
  return sent;
}

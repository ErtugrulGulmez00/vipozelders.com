// Bildirim kanalı stratejisi. Hangi dış kanalın kullanılacağı tek ayardan gelir (Yönetim → Site ayarları → Bildirim kanalı):
//   email    : her şey e-postayla (WhatsApp şablonları Meta'da onaylanana kadar)
//   whatsapp : önce WhatsApp; alıcıya WhatsApp'tan ulaşılamıyorsa (telefon yok, kapattı, kota doldu) e-posta
//   hybrid   : WhatsApp ve e-posta birlikte
// Site/uygulama bildirimi kanaldan bağımsız olarak her zaman oluşturulur.

export const CHANNEL_MODES = ["email", "whatsapp", "hybrid"] as const;
export type ChannelMode = (typeof CHANNEL_MODES)[number];

export const CHANNEL_MODE_LABEL: Record<ChannelMode, string> = {
  email: "Yalnızca e-posta (WhatsApp onay aşamasında)",
  whatsapp: "WhatsApp öncelikli (ulaşılamazsa e-posta)",
  hybrid: "WhatsApp ve e-posta birlikte",
};

export function isChannelMode(value: unknown): value is ChannelMode {
  return typeof value === "string" && (CHANNEL_MODES as readonly string[]).includes(value);
}

/** WhatsApp kullanıcıya açık mı (kapalıyken arayüzde "Onay aşamasında" görünür). */
export function whatsappActive(mode: ChannelMode): boolean {
  return mode !== "email";
}

/** Alıcıya hangi kanallardan ulaşılabilir; alsoEmail: gönderen ayrıca "e-postayla da gönder" dedi. */
export type Reachability = { email: boolean; whatsapp: boolean; alsoEmail?: boolean };
export type ChannelPlan = { email: boolean; whatsapp: boolean };

export function planChannels(mode: ChannelMode, reach: Reachability): ChannelPlan {
  const whatsapp = whatsappActive(mode) && reach.whatsapp;
  const email = reach.email && (mode !== "whatsapp" || !whatsapp || Boolean(reach.alsoEmail));
  return { email, whatsapp };
}

import { db, type DbTransaction } from "./db";
import { appUrl, renderEmail } from "./email";
import { loadSettings } from "./settings";

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  /** E-postada gövdenin altına eklenecek satırlar */
  emailLines?: string[];
  /** false ise yalnızca site içi bildirim */
  email?: boolean;
  /** false ise WhatsApp gönderilmez (önemli bildirim türlerinde varsayılan olarak gider) */
  whatsapp?: boolean;
};

// WhatsApp ile de gönderilen önemli bildirimler (zamana bağlı, kaçırılmaması gerekenler)
const WHATSAPP_TYPES = new Set([
  "booking.request",
  "booking.confirmed",
  "booking.rejected",
  "booking.cancelled",
  "booking.expired",
  "booking.no_show_teacher",
  "booking.reschedule_request",
  "booking.rescheduled",
  "reminder.1h",
  "question.solved",
  "pool.answered",
  "subscription.question",
  "subscription.renewal",
  "group.confirmed",
  "group.cancelled",
  "group.reminder",
  "group.invited",
  "message.new",
  "admin.lesson_request",
]);

/** Site içi bildirim oluşturur ve kullanıcının e-postası varsa e-posta kuyruğuna ekler. */
export async function notify(input: NotifyInput, tx: DbTransaction | typeof db = db) {
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: { email: true, firstName: true, phone: true, whatsappOptOut: true },
  });
  if (!user) return;

  await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });

  if (input.email !== false && user.email) {
    const settings = await loadSettings();
    const { html, text } = renderEmail({
      siteName: settings.siteName,
      greetingName: user.firstName,
      title: input.title,
      lines: [input.body, ...(input.emailLines ?? [])],
      action: input.link ? { label: "Ayrıntıları görüntüle", url: input.link } : undefined,
    });
    await tx.emailMessage.create({
      data: { userId: input.userId, to: user.email, subject: `${input.title} · ${settings.siteName}`, html, text },
    });
  }

  if (input.whatsapp !== false && WHATSAPP_TYPES.has(input.type) && user.phone && !user.whatsappOptOut) {
    const settings = await loadSettings();
    if (settings.whatsappNotifications) {
      const body = [`*${settings.siteName}* · ${input.title}`, input.body, input.link ? appUrl(input.link) : null].filter(Boolean).join("\n");
      // Şablonla gönderimde değişkenler: başlık, metin, bağlantı
      const params = [input.title, input.body, input.link ? appUrl(input.link) : appUrl("/")];
      await tx.whatsAppMessage.create({ data: { userId: input.userId, to: user.phone, body: body.slice(0, 1500), params, type: input.type } });
    }
  }
}

/** Belirli bir role sahip tüm aktif kullanıcılara bildirim (ör. adminlere itiraz uyarısı). */
export async function notifyRole(role: "ADMIN", input: Omit<NotifyInput, "userId">, tx: DbTransaction | typeof db = db) {
  const users = await tx.user.findMany({ where: { role, status: "ACTIVE" }, select: { id: true } });
  for (const user of users) {
    await notify({ ...input, userId: user.id }, tx);
  }
}

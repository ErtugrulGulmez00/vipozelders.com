import { db, type DbTransaction } from "./db";
import { appUrl } from "./email";
import { NotificationService } from "./notification-service";
import { loadSettings } from "./settings";
import { WA_TEMPLATES } from "./whatsapp";

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
  /** false ise WhatsApp gönderilmez (WhatsApp açıkken önemli bildirim türlerinde varsayılan olarak gider) */
  whatsapp?: boolean;
  /** Dersin kısa özeti (lessonSummary); verilirse WhatsApp "ders_durumu" şablonuyla gider */
  lesson?: string;
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

/**
 * Site/uygulama bildirimi oluşturur; dış kanalları (e-posta, WhatsApp) Site ayarlarındaki bildirim kanalına göre
 * NotificationService seçer: "email" modunda her bildirim e-postayla, "whatsapp" modunda önemli türler WhatsApp'la
 * (ulaşılamazsa e-postayla), "hybrid" modunda ikisiyle gider.
 */
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

  const settings = await loadSettings();
  const plan = NotificationService.plan(settings.notificationChannel, {
    email: input.email !== false && Boolean(user.email),
    whatsapp: input.whatsapp !== false && WHATSAPP_TYPES.has(input.type) && Boolean(user.phone) && !user.whatsappOptOut,
  });

  if (plan.email && user.email) {
    await NotificationService.email.enqueue(tx, {
      userId: input.userId,
      to: user.email,
      subject: `${input.title} · ${settings.siteName}`,
      senderName: settings.siteName,
      greetingName: user.firstName,
      title: input.title,
      lines: [input.body, ...(input.emailLines ?? [])],
      action: input.link ? { label: "Ayrıntıları görüntüle", url: input.link } : undefined,
    });
  }

  if (plan.whatsapp && user.phone) {
    const link = input.link ? appUrl(input.link) : appUrl("/");
    // Ders bildirimleri: ders_durumu (ders, ne oldu, bağlantı); diğerleri: site ayarındaki genel şablon (başlık, metin, bağlantı) ya da düz metin
    await NotificationService.whatsapp.enqueue(tx, {
      userId: input.userId,
      to: user.phone,
      body: [`*${settings.siteName}* · ${input.title}`, input.body, input.link ? link : null].filter(Boolean).join("\n"),
      template: input.lesson ? WA_TEMPLATES.lesson : null,
      params: input.lesson ? [input.lesson, input.title, link] : [input.title, input.body, link],
      type: input.type,
    });
  }
}

/** Belirli bir role sahip tüm aktif kullanıcılara bildirim (ör. adminlere itiraz uyarısı). */
export async function notifyRole(role: "ADMIN", input: Omit<NotifyInput, "userId">, tx: DbTransaction | typeof db = db) {
  const users = await tx.user.findMany({ where: { role, status: "ACTIVE" }, select: { id: true } });
  for (const user of users) {
    await notify({ ...input, userId: user.id }, tx);
  }
}

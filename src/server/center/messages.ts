import { toLocalDateString } from "@/lib/dates";
import { whatsappActive } from "@/lib/notification-channels";
import { db, type DbTransaction } from "../db";
import { appUrl } from "../email";
import { NotificationService } from "../notification-service";
import { notify } from "../notifications";
import { loadSettings } from "../settings";

// Kurumun velilere gönderdiği mesajlar. Dış kanal Site ayarlarındaki bildirim kanalına göre seçilir (NotificationService):
// "email" modunda veliye e-posta, "whatsapp" modunda WhatsApp (telefon yoksa/kapalıysa/kota dolduysa e-posta),
// "hybrid" modunda ikisi birden. SMS yok. Portala bağlı velilere ayrıca site/uygulama bildirimi gider.
// Her dış mesaj CenterMessage olarak kurumun mesaj geçmişine yazılır; gönderimi genel kuyruklar yapar, durum
// zamanlayıcıyla eşitlenir. WhatsApp'ta kurum başına aylık sınır vardır (Site ayarları).

type Tx = DbTransaction | typeof db;

export type GuardianMessageInput = {
  centerId: string;
  centerName: string;
  studentId: string;
  kind: string;
  /** Veliye giden dış mesajın metni (kanala göre WhatsApp ve/veya e-posta); null ise yalnızca bildirim */
  message?: string | null;
  /** Dış mesajın başlığı; verilmezse bildirim başlığı */
  messageTitle?: string;
  /** Meta onaylı özel WhatsApp şablonu ve değişkenleri (ör. devamsızlık); verilmezse genel şablon/düz metin */
  template?: { name: string; params: string[] };
  /** Mesajdaki bağlantı (site içi yol); verilmezse veli portalı */
  link?: string;
  /** E-postanın kendine özel içeriği (duyuru, elle mesaj); verilmezse mesaj metninden oluşturulur */
  email?: { subject: string; title: string; lines: string[]; action?: { label: string; url: string } } | null;
  /** Hesabını kuruma bağlamış velinin site/uygulama bildirimi */
  notification?: { title: string; body: string } | null;
  /** Velinin kurumdaki "WhatsApp/e-posta almasın" işaretine bakılmaz (elle gönderilen mesajlar) */
  force?: boolean;
  /** Yalnızca bu velilere */
  guardianIds?: string[];
  /** Gönderenin seçtiği kanallar (duyuru, elle mesaj); false olan kanal kullanılmaz, email: true ise ayrıca e-posta gider */
  channels?: { whatsapp?: boolean; email?: boolean };
};

/** Şablonlarda kurumla iletişim: "Kurum adı (telefon)" */
export function centerContact(center: { name: string; phone?: string | null }) {
  return center.phone ? `${center.name} (${center.phone})` : center.name;
}

export type MessageCounts = { whatsapp: number; email: number; app: number };

/** Öğrencinin kendi hesabına da e-postayla giden mesajlar (devamsızlık, ödeme, davet gibi veli mesajları gitmez). */
const STUDENT_EMAIL_KINDS = new Set(["question_answered", "homework", "homework_missing", "exam_result", "announcement"]);

const LIMIT_ERROR = "Aylık WhatsApp sınırı doldu";

function monthStart(now = new Date()) {
  return new Date(`${toLocalDateString(now).slice(0, 7)}-01T00:00:00+03:00`);
}

/** Kurumun bu ay kullandığı WhatsApp mesajı (sırada + gönderilen) ve sınırı; enabled: bildirim kanalında WhatsApp açık mı. */
export async function centerWhatsappUsage(centerId: string, tx: Tx = db) {
  const [used, settings] = await Promise.all([
    tx.centerMessage.count({ where: { centerId, channel: "WHATSAPP", status: { in: ["QUEUED", "SENT"] }, createdAt: { gte: monthStart() } } }),
    loadSettings(),
  ]);
  return { used, limit: settings.centerWhatsappMonthlyLimit, enabled: whatsappActive(settings.notificationChannel) };
}

export async function messageGuardians(input: GuardianMessageInput, tx: Tx = db): Promise<MessageCounts> {
  const guardians = await tx.centerGuardian.findMany({
    where: { studentId: input.studentId, centerId: input.centerId, ...(input.guardianIds ? { id: { in: input.guardianIds } } : {}) },
    select: { id: true, phone: true, email: true, notifyWhatsapp: true, notifyEmail: true, userId: true, fullName: true, isStudentAccount: true, user: { select: { whatsappOptOut: true, email: true } } },
  });
  const counts: MessageCounts = { whatsapp: 0, email: 0, app: 0 };
  const sentTo = new Set<string>();
  const mode = await NotificationService.mode();
  const message = input.message ?? null;

  let whatsappLeft = 0;
  if (message && whatsappActive(mode) && input.channels?.whatsapp !== false) {
    const usage = await centerWhatsappUsage(input.centerId, tx);
    whatsappLeft = Math.max(0, usage.limit - usage.used);
  }
  const subject = input.messageTitle ?? input.notification?.title ?? "Bilgilendirme";
  const title = `${input.centerName} · ${subject}`;

  for (const guardian of guardians) {
    if (guardian.isStudentAccount) {
      // Bağlanmamış (davet bekleyen) öğrenci hesabına bir şey gitmez
      if (!guardian.userId) continue;
      if (input.notification) {
        await tx.notification.create({ data: { userId: guardian.userId, type: `center.${input.kind}`, title: input.notification.title, body: input.notification.body, link: `/hesabim/kurum/${guardian.id}` } });
        counts.app++;
      }
      const studentEmail = guardian.user?.email;
      const text = message ?? input.notification?.body;
      if (studentEmail && text && STUDENT_EMAIL_KINDS.has(input.kind) && input.channels?.email !== false && !sentTo.has(`email:${studentEmail}`)) {
        sentTo.add(`email:${studentEmail}`);
        const content = input.email ?? { subject, title: subject, lines: text.split(/\r?\n/).filter(Boolean), action: { label: "Ayrıntıları görüntüle", url: `/hesabim/kurum/${guardian.id}` } };
        const queued = await NotificationService.email.enqueue(tx, {
          userId: guardian.userId,
          to: studentEmail,
          subject: `${content.subject} · ${input.centerName}`,
          senderName: input.centerName,
          greetingName: guardian.fullName.split(" ")[0],
          title: content.title,
          lines: content.lines,
          action: content.action,
        });
        await tx.centerMessage.create({ data: { centerId: input.centerId, channel: "EMAIL", to: studentEmail, subject: content.subject, body: queued.text, kind: input.kind, studentId: input.studentId, providerId: queued.id } });
        counts.email++;
      }
      continue;
    }
    const path = input.link ?? (guardian.userId ? `/hesabim/kurum/${guardian.id}` : "/hesabim/kurum");
    const phone = guardian.phone;
    const email = guardian.email;

    if (message) {
      const waWanted =
        whatsappActive(mode) && input.channels?.whatsapp !== false && Boolean(phone) && (guardian.notifyWhatsapp || Boolean(input.force)) && !(guardian.user?.whatsappOptOut && !input.force) && !sentTo.has(`wa:${phone}`);
      // Kota dolduysa WhatsApp atlanır (geçmişe "gönderilmedi" yazılır); "whatsapp" modunda e-postaya düşer
      if (waWanted && whatsappLeft <= 0) {
        sentTo.add(`wa:${phone}`);
        await tx.centerMessage.create({ data: { centerId: input.centerId, channel: "WHATSAPP", to: phone!, body: message, kind: input.kind, studentId: input.studentId, status: "SKIPPED", error: LIMIT_ERROR } });
      }
      const plan = NotificationService.plan(mode, {
        whatsapp: waWanted && whatsappLeft > 0,
        email: input.channels?.email !== false && Boolean(email) && (guardian.notifyEmail || Boolean(input.force)) && !sentTo.has(`email:${email}`),
        alsoEmail: input.channels?.email === true,
      });

      if (plan.whatsapp && phone) {
        sentTo.add(`wa:${phone}`);
        whatsappLeft--;
        const link = appUrl(path);
        const queued = await NotificationService.whatsapp.enqueue(tx, {
          userId: guardian.userId,
          to: phone,
          body: [`*${title}*`, message, link].join("\n"),
          template: input.template?.name ?? null,
          params: input.template?.params ?? [title, message, link],
          type: `center.${input.kind}`,
        });
        await tx.centerMessage.create({ data: { centerId: input.centerId, channel: "WHATSAPP", to: phone, body: message, kind: input.kind, studentId: input.studentId, providerId: queued.id } });
        counts.whatsapp++;
      }
      if (plan.email && email) {
        sentTo.add(`email:${email}`);
        const content = input.email ?? { subject, title: subject, lines: message.split(/\r?\n/).filter(Boolean), action: { label: "Ayrıntıları görüntüle", url: path } };
        const queued = await NotificationService.email.enqueue(tx, {
          userId: guardian.userId,
          to: email,
          subject: `${content.subject} · ${input.centerName}`,
          senderName: input.centerName,
          greetingName: guardian.fullName.split(" ")[0],
          title: content.title,
          lines: content.lines,
          action: content.action,
        });
        await tx.centerMessage.create({ data: { centerId: input.centerId, channel: "EMAIL", to: email, subject: content.subject, body: queued.text, kind: input.kind, studentId: input.studentId, providerId: queued.id } });
        counts.email++;
      }
    }

    if (input.notification && guardian.userId) {
      await tx.notification.create({
        data: { userId: guardian.userId, type: `center.${input.kind}`, title: input.notification.title, body: input.notification.body, link: `/hesabim/kurum/${guardian.id}` },
      });
      counts.app++;
    }
  }
  return counts;
}

/** Kurum yöneticilerine (sahip ve müdür) bildirim; dış kanal (e-posta/WhatsApp) bildirim kanalı ayarına göre. */
export async function notifyCenterManagers(centerId: string, notification: { type: string; title: string; body: string; link: string }, tx: Tx = db) {
  const managers = await tx.centerMember.findMany({ where: { centerId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { userId: true } });
  for (const m of managers) {
    await notify({ userId: m.userId, ...notification, whatsapp: false }, tx);
  }
}


/** Zamanlayıcı görevi: WhatsApp ve e-posta durumlarını genel kuyruklardan eşitler; sınırı dolan kurumun yöneticisine bir kez haber verir. */
export async function processCenterMessages(now = new Date()): Promise<number> {
  let processed = 0;

  // SMS kaldırıldı: sırada kalmış eski SMS'ler gönderilmez
  const oldSms = await db.centerMessage.updateMany({ where: { channel: "SMS", status: "QUEUED" }, data: { status: "SKIPPED", error: "SMS kaldırıldı." } });
  processed += oldSms.count;

  const queued = await db.centerMessage.findMany({ where: { channel: { in: ["WHATSAPP", "EMAIL"] }, status: "QUEUED", providerId: { not: null } }, select: { id: true, channel: true, providerId: true }, take: 500 });
  if (queued.length) {
    const ids = (channel: "WHATSAPP" | "EMAIL") => queued.filter((m) => m.channel === channel).map((m) => m.providerId!);
    const done = { status: { in: ["SENT", "FAILED"] as ("SENT" | "FAILED")[] } };
    const [whatsapps, emails] = await Promise.all([
      db.whatsAppMessage.findMany({ where: { id: { in: ids("WHATSAPP") }, ...done }, select: { id: true, status: true, sentAt: true, error: true } }),
      db.emailMessage.findMany({ where: { id: { in: ids("EMAIL") }, ...done }, select: { id: true, status: true, sentAt: true, error: true } }),
    ]);
    const byId = new Map([...whatsapps, ...emails].map((s) => [s.id, s]));
    for (const message of queued) {
      const state = byId.get(message.providerId!);
      if (!state) continue;
      await db.centerMessage.update({
        where: { id: message.id },
        data:
          state.status === "SENT"
            ? { status: "SENT", sentAt: state.sentAt ?? now }
            : { status: "FAILED", error: state.error?.slice(0, 300) ?? (message.channel === "EMAIL" ? "E-posta gönderilemedi" : "WhatsApp mesajı gönderilemedi") },
      });
      processed++;
    }
  }

  // Bu ay sınırı dolan kurumlar: yöneticilere ayda bir kez bildirim
  const start = monthStart(now);
  const limited = await db.centerMessage.groupBy({ by: ["centerId"], where: { channel: "WHATSAPP", status: "SKIPPED", error: LIMIT_ERROR, createdAt: { gte: start } } });
  for (const { centerId } of limited) {
    const type = `center.whatsapp_limit.${toLocalDateString(now).slice(0, 7)}`;
    const managers = await db.centerMember.findMany({ where: { centerId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { userId: true } });
    const already = await db.notification.count({ where: { type, userId: { in: managers.map((m) => m.userId) } } });
    if (already) continue;
    const { limit } = await centerWhatsappUsage(centerId);
    await notifyCenterManagers(centerId, {
      type,
      title: "Aylık WhatsApp sınırı doldu",
      body: `Bu ay ${limit} WhatsApp mesajı hakkınız doldu. Ay sonuna kadar velilere e-posta ve site/uygulama bildirimi gidiyor. Ek kota için Pi Kampüs ile görüşün.`,
      link: "/kurum/mesajlar",
    });
  }
  return processed;
}

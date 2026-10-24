import { toLocalDateString } from "@/lib/dates";
import { db, type DbTransaction } from "../db";
import { appUrl, renderEmail } from "../email";
import { loadSettings } from "../settings";

// Kurumun velilere gönderdiği WhatsApp, e-posta ve site/uygulama bildirimleri. SMS yok: veliye her şey WhatsApp ve
// bildirimle gider; e-posta yalnızca kurumun açıkça seçtiği duyuru ve mesajlarda. Her WhatsApp/e-posta CenterMessage
// olarak kurumun mesaj geçmişine yazılır; gönderimi genel kuyruklar yapar (WhatsAppMessage, EmailMessage), durum
// zamanlayıcıyla eşitlenir. WhatsApp'ta kurum başına aylık sınır vardır (Site ayarları).

type Tx = DbTransaction | typeof db;

export type GuardianMessageInput = {
  centerId: string;
  centerName: string;
  studentId: string;
  kind: string;
  /** WhatsApp metni; başlıkta kurum adı yer alır */
  whatsapp?: string | null;
  /** WhatsApp başlığı; verilmezse bildirim başlığı */
  whatsappTitle?: string;
  /** WhatsApp'taki bağlantı (site içi yol); verilmezse veli portalı */
  link?: string;
  /** Yalnızca kurumun "e-postayla da gönder" seçtiği duyuru/mesajlarda */
  email?: { subject: string; title: string; lines: string[]; action?: { label: string; url: string } } | null;
  /** Hesabını kuruma bağlamış velinin site/uygulama bildirimi */
  notification?: { title: string; body: string } | null;
  /** Velinin kurumdaki "WhatsApp/e-posta almasın" işaretine bakılmaz (elle gönderilen mesajlar) */
  force?: boolean;
  /** Yalnızca bu velilere */
  guardianIds?: string[];
  channels?: { whatsapp?: boolean; email?: boolean };
};

export type MessageCounts = { whatsapp: number; email: number; app: number };

const LIMIT_ERROR = "Aylık WhatsApp sınırı doldu";

function monthStart(now = new Date()) {
  return new Date(`${toLocalDateString(now).slice(0, 7)}-01T00:00:00+03:00`);
}

/** Kurumun bu ay kullandığı WhatsApp mesajı (sırada + gönderilen) ve sınırı. */
export async function centerWhatsappUsage(centerId: string, tx: Tx = db) {
  const [used, settings] = await Promise.all([
    tx.centerMessage.count({ where: { centerId, channel: "WHATSAPP", status: { in: ["QUEUED", "SENT"] }, createdAt: { gte: monthStart() } } }),
    loadSettings(),
  ]);
  return { used, limit: settings.centerWhatsappMonthlyLimit, enabled: settings.whatsappNotifications };
}

export async function messageGuardians(input: GuardianMessageInput, tx: Tx = db): Promise<MessageCounts> {
  const guardians = await tx.centerGuardian.findMany({
    where: { studentId: input.studentId, centerId: input.centerId, ...(input.guardianIds ? { id: { in: input.guardianIds } } : {}) },
    select: { id: true, phone: true, email: true, notifyWhatsapp: true, notifyEmail: true, userId: true, fullName: true, isStudentAccount: true, user: { select: { whatsappOptOut: true } } },
  });
  const counts: MessageCounts = { whatsapp: 0, email: 0, app: 0 };
  const sentTo = new Set<string>();

  const wantsWhatsapp = Boolean(input.whatsapp) && input.channels?.whatsapp !== false;
  let whatsappLeft = 0;
  if (wantsWhatsapp) {
    const usage = await centerWhatsappUsage(input.centerId, tx);
    whatsappLeft = usage.enabled ? Math.max(0, usage.limit - usage.used) : 0;
  }
  const title = `${input.centerName} · ${input.whatsappTitle ?? input.notification?.title ?? "Bilgilendirme"}`;

  for (const guardian of guardians) {
    if (guardian.isStudentAccount) {
      if (input.notification && guardian.userId) {
        await tx.notification.create({ data: { userId: guardian.userId, type: `center.${input.kind}`, title: input.notification.title, body: input.notification.body, link: `/hesabim/kurum/${guardian.id}` } });
        counts.app++;
      }
      continue;
    }
    const phone = guardian.phone;
    if (input.whatsapp && wantsWhatsapp && phone && (guardian.notifyWhatsapp || input.force) && !(guardian.user?.whatsappOptOut && !input.force) && !sentTo.has(`wa:${phone}`)) {
      sentTo.add(`wa:${phone}`);
      if (whatsappLeft > 0) {
        whatsappLeft--;
        const link = appUrl(input.link ?? (guardian.userId ? `/hesabim/kurum/${guardian.id}` : "/hesabim/kurum"));
        const body = [`*${title}*`, input.whatsapp, link].join("\n").slice(0, 1500);
        const message = await tx.whatsAppMessage.create({ data: { userId: guardian.userId, to: phone, body, params: [title, input.whatsapp, link], type: `center.${input.kind}` } });
        await tx.centerMessage.create({
          data: { centerId: input.centerId, channel: "WHATSAPP", to: phone, body: input.whatsapp, kind: input.kind, studentId: input.studentId, providerId: message.id },
        });
        counts.whatsapp++;
      } else {
        await tx.centerMessage.create({
          data: { centerId: input.centerId, channel: "WHATSAPP", to: phone, body: input.whatsapp, kind: input.kind, studentId: input.studentId, status: "SKIPPED", error: LIMIT_ERROR },
        });
      }
    }
    if (input.email && input.channels?.email !== false && guardian.email && (guardian.notifyEmail || input.force) && !sentTo.has(`email:${guardian.email}`)) {
      sentTo.add(`email:${guardian.email}`);
      const { html, text } = renderEmail({
        siteName: input.centerName,
        greetingName: guardian.fullName.split(" ")[0],
        title: input.email.title,
        lines: input.email.lines,
        action: input.email.action,
      });
      const email = await tx.emailMessage.create({ data: { userId: guardian.userId, to: guardian.email, subject: `${input.email.subject} · ${input.centerName}`, html, text } });
      await tx.centerMessage.create({
        data: { centerId: input.centerId, channel: "EMAIL", to: guardian.email, subject: input.email.subject, body: text, kind: input.kind, studentId: input.studentId, providerId: email.id },
      });
      counts.email++;
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

/** Kurum yöneticilerine (sahip ve müdür) site içi bildirim. */
export async function notifyCenterManagers(centerId: string, notification: { type: string; title: string; body: string; link: string }, tx: Tx = db) {
  const managers = await tx.centerMember.findMany({ where: { centerId, isActive: true, role: { in: ["OWNER", "MANAGER"] } }, select: { userId: true } });
  if (managers.length) {
    await tx.notification.createMany({ data: managers.map((m) => ({ userId: m.userId, ...notification })) });
  }
}

/** Zamanlayıcı görevi: WhatsApp ve e-posta durumlarını genel kuyruklardan eşitler; sınırı dolan kurumun yöneticisine bir kez haber verir. */
export async function processCenterMessages(now = new Date()): Promise<number> {
  let processed = 0;

  // SMS kaldırıldı: sırada kalmış eski SMS'ler gönderilmez
  const oldSms = await db.centerMessage.updateMany({ where: { channel: "SMS", status: "QUEUED" }, data: { status: "SKIPPED", error: "SMS kaldırıldı; mesajlar WhatsApp ile gider." } });
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
      body: `Bu ay ${limit} WhatsApp mesajı hakkınız doldu. Ay sonuna kadar velilere yalnızca site/uygulama bildirimi gidiyor. Ek kota için Pi Kampüs ile görüşün.`,
      link: "/kurum/mesajlar",
    });
  }
  return processed;
}

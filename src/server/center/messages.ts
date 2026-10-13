import { db, type DbTransaction } from "../db";
import { renderEmail } from "../email";
import { sendSms, smsConfigured } from "./sms";

// Kurumun velilere gönderdiği SMS, e-posta ve site içi bildirimler. Her gönderim CenterMessage olarak
// kurumun mesaj geçmişine yazılır; SMS'ler zamanlayıcıyla Netgsm'e iletilir, e-postalar genel kuyruğa girer.

type Tx = DbTransaction | typeof db;

export type GuardianMessageInput = {
  centerId: string;
  centerName: string;
  studentId: string;
  kind: string;
  /** Kısa SMS metni; başına kurum adı eklenir */
  sms?: string | null;
  email?: { subject: string; title: string; lines: string[]; action?: { label: string; url: string } } | null;
  /** Hesabını kuruma bağlamış velinin site/uygulama bildirimi */
  notification?: { title: string; body: string } | null;
  /** Velinin "SMS/e-posta almak istemiyorum" tercihine bakılmaz (elle gönderilen mesajlar) */
  force?: boolean;
  /** Yalnızca bu velilere */
  guardianIds?: string[];
  channels?: { sms?: boolean; email?: boolean };
};

export type MessageCounts = { sms: number; email: number; app: number };

export function smsText(centerName: string, text: string): string {
  return `${centerName}: ${text}`.slice(0, 450);
}

export async function messageGuardians(input: GuardianMessageInput, tx: Tx = db): Promise<MessageCounts> {
  const guardians = await tx.centerGuardian.findMany({
    where: { studentId: input.studentId, centerId: input.centerId, ...(input.guardianIds ? { id: { in: input.guardianIds } } : {}) },
    select: { id: true, phone: true, email: true, notifySms: true, notifyEmail: true, userId: true, fullName: true, isStudentAccount: true },
  });
  const counts: MessageCounts = { sms: 0, email: 0, app: 0 };
  const sentTo = new Set<string>();

  for (const guardian of guardians) {
    if (guardian.isStudentAccount) {
      if (input.notification && guardian.userId) {
        await tx.notification.create({ data: { userId: guardian.userId, type: `center.${input.kind}`, title: input.notification.title, body: input.notification.body, link: `/hesabim/kurum/${guardian.id}` } });
        counts.app++;
      }
      continue;
    }
    if (input.sms && input.channels?.sms !== false && guardian.phone && (guardian.notifySms || input.force) && !sentTo.has(`sms:${guardian.phone}`)) {
      sentTo.add(`sms:${guardian.phone}`);
      await tx.centerMessage.create({
        data: { centerId: input.centerId, channel: "SMS", to: guardian.phone, body: smsText(input.centerName, input.sms), kind: input.kind, studentId: input.studentId },
      });
      counts.sms++;
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

/** Zamanlayıcı görevi: sıradaki SMS'leri gönderir, e-posta durumlarını genel kuyruktan eşitler. */
export async function processCenterMessages(): Promise<number> {
  let processed = 0;
  const queued = await db.centerMessage.findMany({ where: { channel: "SMS", status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 100 });
  if (queued.length) {
    if (!smsConfigured()) {
      await db.centerMessage.updateMany({
        where: { id: { in: queued.map((m) => m.id) } },
        data: { status: "SKIPPED", error: "SMS sağlayıcısı tanımlı değil; mesaj yalnızca kayıt altına alındı." },
      });
      processed += queued.length;
    } else {
      for (const message of queued) {
        const result = await sendSms(message.to, message.body);
        await db.centerMessage.update({
          where: { id: message.id },
          data: result.ok ? { status: "SENT", providerId: result.providerId, sentAt: new Date(), error: null } : { status: "FAILED", error: result.error },
        });
        processed++;
      }
    }
  }

  const emails = await db.centerMessage.findMany({ where: { channel: "EMAIL", status: "QUEUED", providerId: { not: null } }, select: { id: true, providerId: true }, take: 200 });
  if (emails.length) {
    const states = await db.emailMessage.findMany({ where: { id: { in: emails.map((e) => e.providerId!) }, status: { in: ["SENT", "FAILED"] } }, select: { id: true, status: true, sentAt: true, error: true } });
    const byId = new Map(states.map((s) => [s.id, s]));
    for (const message of emails) {
      const state = byId.get(message.providerId!);
      if (!state) continue;
      await db.centerMessage.update({
        where: { id: message.id },
        data: state.status === "SENT" ? { status: "SENT", sentAt: state.sentAt ?? new Date() } : { status: "FAILED", error: state.error?.slice(0, 300) ?? "E-posta gönderilemedi" },
      });
      processed++;
    }
  }
  return processed;
}

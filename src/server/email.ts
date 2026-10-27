import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailContent = {
  siteName: string;
  greetingName?: string;
  title: string;
  lines: string[];
  action?: { label: string; url: string };
};

/** Tüm sistem e-postaları için sade, mobil uyumlu şablon. */
export function renderEmail(content: EmailContent): { html: string; text: string } {
  const greeting = content.greetingName ? `Merhaba ${content.greetingName},` : "Merhaba,";
  const actionUrl = content.action ? appUrl(content.action.url) : null;

  const text = [
    greeting,
    "",
    content.title,
    "",
    ...content.lines,
    ...(content.action && actionUrl ? ["", `${content.action.label}: ${actionUrl}`] : []),
    "",
    `— ${content.siteName}`,
  ].join("\n");

  const html = `<!doctype html><html lang="tr"><body style="margin:0;background:#f4f4f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#1b1f3b;color:#ffffff;padding:18px 24px;font-size:18px;font-weight:bold">${escapeHtml(content.siteName)}</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
<h1 style="font-size:20px;margin:0 0 16px;color:#111827">${escapeHtml(content.title)}</h1>
${content.lines.map((line) => `<p style="margin:0 0 10px;line-height:1.5">${escapeHtml(line)}</p>`).join("")}
${
  content.action && actionUrl
    ? `<p style="margin:24px 0 8px"><a href="${escapeHtml(actionUrl)}" style="background:#d63f1c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block;font-weight:bold">${escapeHtml(content.action.label)}</a></p>`
    : ""
}
</td></tr>
<tr><td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px">Bu e-posta ${escapeHtml(content.siteName)} tarafından otomatik gönderilmiştir.</td></tr>
</table></td></tr></table></body></html>`;

  return { html, text };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

/**
 * Kuyruktaki e-postaları gönderir. SMTP ayarlı değilse (geliştirme) e-posta
 * "gönderildi" sayılır ve admin panelindeki E-posta Kutusu'ndan okunur.
 */
export async function sendPendingEmails(limit = 20): Promise<number> {
  const pending = await db.emailMessage.findMany({
    where: { status: "PENDING", attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const smtp = getTransporter();

  for (const message of pending) {
    try {
      if (smtp) {
        await smtp.sendMail({
          from: process.env.EMAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
      }
      await db.emailMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, error: smtp ? null : "SMTP yok: yalnızca kayıt" },
      });
    } catch (error) {
      const attempts = message.attempts + 1;
      await db.emailMessage.update({
        where: { id: message.id },
        data: { attempts, status: attempts >= 5 ? "FAILED" : "PENDING", error: String(error).slice(0, 500) },
      });
    }
  }
  return pending.length;
}
